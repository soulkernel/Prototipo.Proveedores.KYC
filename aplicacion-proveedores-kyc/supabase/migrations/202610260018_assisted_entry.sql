-- Assisted entry: authenticated KYC permissions, same form and signed receipt rules.
begin;
alter table public.glf_kyc_cases add column assisted boolean not null default false,
 add column edit_epoch integer not null default 1;
alter table glf_kyc_private.uploads add column edit_epoch integer,
 add column actor_id uuid;
-- Historical answer revisions stay private. Audit events contain field names, not values.
create table glf_kyc_private.answer_revisions(
 id uuid primary key default gen_random_uuid(),case_id uuid not null references public.glf_kyc_cases(id),
 version integer not null,before_answers jsonb not null,after_answers jsonb not null,
 source text not null,actor_id uuid,created_at timestamptz not null default now());
alter table glf_kyc_private.answer_revisions enable row level security;
revoke all on glf_kyc_private.answer_revisions from public,anon,authenticated;
create function glf_kyc_private.audit_answers() returns trigger language plpgsql security definer set search_path='' as $$
declare responsible text;source text;changed jsonb;
begin
 if old.assisted and new.state in('review','approved','not_approved') then raise exception 'ASSISTANCE_ACTIVE';end if;
 if new.state='invited' then new.assisted=false;end if;
 if new.assisted is distinct from old.assisted or new.state is distinct from old.state then new.edit_epoch=old.edit_epoch+1;end if;
 if new.answers is distinct from old.answers then
  source=case when old.assisted then 'assisted' when old.state='invited' and auth.uid() is null then 'applicant' else 'internal' end;
  select display_name into responsible from public.glf_profiles where id=auth.uid();
  select coalesce(jsonb_agg(k order by k),'[]') into changed from (select key k from jsonb_object_keys(old.answers||new.answers) as key where old.answers->key is distinct from new.answers->key) q;
  insert into glf_kyc_private.answer_revisions(case_id,version,before_answers,after_answers,source,actor_id) values(new.id,new.version,old.answers,new.answers,source,auth.uid());
  insert into public.glf_kyc_events(case_id,action,actor_id,detail) values(new.id,'answers_saved',auth.uid(),jsonb_build_object('source',source,'responsible',responsible,'version',new.version,'fields',changed)::text);
 end if;return new;
end;$$;
create trigger kyc_answer_audit before update on public.glf_kyc_cases for each row execute function glf_kyc_private.audit_answers();
create function glf_kyc_private.expire_uploads() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update glf_kyc_private.uploads set expires_at=now() where case_id=new.case_id and external and not committed;
 return new;
end;$$;
create trigger kyc_invitation_upload_expiry after update on glf_kyc_private.invitations for each row execute function glf_kyc_private.expire_uploads();

create function public.glf_kyc_assist(p_id uuid,p_version integer,p_epoch integer,p_action text,p_answers jsonb default null,p_reason text default '',p_scan boolean default false,p_confirm boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.glf_kyc_cases;a jsonb;k text;responsible text;
begin
 if not public.glf_kyc_allowed() then raise exception 'FORBIDDEN';end if;
 select * into c from public.glf_kyc_cases where id=p_id for update;
 if not found or c.state not in('draft','invited','correction') then raise exception 'INVALID_STATE';end if;
 if c.version is distinct from p_version or c.edit_epoch is distinct from p_epoch then raise exception 'STALE_VERSION';end if;
 select display_name into responsible from public.glf_profiles where id=auth.uid();
 if p_action='start' then
  if c.assisted then return to_jsonb(c);end if;
  if length(trim(coalesce(p_reason,''))) not between 5 and 1000 or not coalesce(p_confirm,false) then raise exception 'ASSIST_REASON_REQUIRED';end if;
  -- The case lock serializes external saves. Changing state invalidates links immediately.
  update public.glf_kyc_cases set assisted=true,state=case when state='invited' then 'draft' else state end,allow_scan=p_scan,updated_at=now() where id=p_id returning * into c;
  update glf_kyc_private.invitations set revoked=true where case_id=p_id;
  insert into public.glf_kyc_events(case_id,action,actor_id,detail) values(p_id,'assistance_started',auth.uid(),jsonb_build_object('responsible',responsible,'reason',trim(p_reason),'version',c.version)::text);
  return to_jsonb(c);
 end if;
 if not c.assisted then raise exception 'ASSISTANCE_INACTIVE';end if;
 if p_action='save' then
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>100000 then raise exception 'INVALID';end if;
  a=glf_kyc_private.project(p_answers);if a->>'relation' is distinct from c.relation then raise exception 'ROUTE_MISMATCH';end if;
  if a is distinct from c.answers or c.form_version<>'2026-10-25.2' then
   update public.glf_kyc_cases set answers=a,version=version+1,pdf_version=null,form_version='2026-10-25.2',updated_at=now() where id=p_id returning * into c;
  end if;return to_jsonb(c.version);
 elsif p_action in('pdf','submit') then
  if array_length(glf_kyc_private.validate(c.answers),1)>0 then raise exception 'INCOMPLETE_FORM';end if;
  if p_action='pdf' then
   update public.glf_kyc_cases set pdf_version=version where id=p_id;
   return 'true'::jsonb;
  end if;
  if not coalesce(p_confirm,false) then raise exception 'ASSIST_SIGNATURE_REQUIRED';end if;
  if c.pdf_version is distinct from c.version then raise exception 'PDF_REQUIRED';end if;
  foreach k in array glf_kyc_private.documents(c.answers) loop
   if not exists(select 1 from public.glf_kyc_files where case_id=p_id and slot=k and version=c.version) then raise exception 'MISSING_DOCUMENT';end if;
  end loop;
  insert into glf_kyc_private.submissions(case_id,version,answers,files) values(p_id,c.version,c.answers,(select jsonb_agg(to_jsonb(f)) from public.glf_kyc_files f where f.case_id=p_id and f.version=c.version));
  update public.glf_kyc_cases set state='submitted',assisted=false,receipt_at=now(),updated_at=now() where id=p_id;
  update glf_kyc_private.invitations set revoked=true where case_id=p_id;
  insert into public.glf_kyc_events(case_id,action,actor_id,detail) values(p_id,'assisted_submitted',auth.uid(),jsonb_build_object('responsible',responsible,'version',c.version,'signature_checked',true)::text);
  return jsonb_build_object('code',c.code,'received_at',now(),'version',c.version);
 end if;raise exception 'INVALID_ACTION';
end;$$;
create or replace function public.glf_kyc_upload_ticket(p_token text,p_id uuid,p_version integer,p_slot text) returns text language plpgsql security definer set search_path='' as $$
declare cid uuid;c public.glf_kyc_cases;path text;ext boolean:=p_token is not null;
begin
 if ext then cid=glf_kyc_private.token_case(p_token);else if not public.glf_kyc_allowed() then raise exception 'FORBIDDEN';end if;cid=p_id;end if;
 if cid is null then raise exception 'LINK_INVALID';end if;select * into c from public.glf_kyc_cases where id=cid for update;
 if not found or c.version<>p_version then raise exception 'STALE_VERSION';end if;
 if ext and (glf_kyc_private.token_case(p_token) is distinct from cid or p_slot not in(select unnest(glf_kyc_private.documents(c.answers)))) then raise exception 'INVALID_SLOT';end if;
 if not ext then
 if c.assisted and c.state in('draft','correction') then
  if p_slot<>'other' and p_slot not in(select unnest(glf_kyc_private.documents(c.answers))) then raise exception 'INVALID_SLOT';end if;
 elsif p_slot not in('report','countersigned','other') or c.state not in('submitted','review','correction') then raise exception 'INVALID_SLOT';end if;
 end if;
 if p_slot='signed' and c.pdf_version is distinct from c.version then raise exception 'PDF_REQUIRED';end if;
 if (select count(*) from public.glf_kyc_files where case_id=cid)>=200 then raise exception 'UPLOAD_LIMIT';end if;
 if (select coalesce(sum(bytes),0) from public.glf_kyc_files where case_id=cid)>157286400 then raise exception 'UPLOAD_LIMIT';end if;
 if (select count(*) from glf_kyc_private.uploads where case_id=cid and expires_at>now() and not committed)>50 then raise exception 'UPLOAD_LIMIT';end if;
 path=cid::text||'/'||gen_random_uuid()::text;
 insert into glf_kyc_private.uploads(path,case_id,slot,version,expires_at,committed,external,edit_epoch,actor_id) values(path,cid,p_slot,c.version,now()+interval '15 minutes',false,ext,c.edit_epoch,case when ext then null else auth.uid() end);return path;
end;$$;
create or replace function public.glf_kyc_attach(p_token text,p_path text,p_name text) returns boolean language plpgsql security definer set search_path='' as $$
declare u glf_kyc_private.uploads;c public.glf_kyc_cases;m jsonb;
begin
 select * into u from glf_kyc_private.uploads where path=p_path for update;if not found then raise exception 'INVALID_UPLOAD';end if;
 if u.external then if glf_kyc_private.token_case(p_token) is distinct from u.case_id then raise exception 'LINK_INVALID';end if;else if not public.glf_kyc_allowed() then raise exception 'FORBIDDEN';end if;end if;
 select * into c from public.glf_kyc_cases where id=u.case_id for update;
 if u.expires_at<=now() or u.edit_epoch is distinct from c.edit_epoch or (not u.external and u.actor_id is distinct from auth.uid()) or u.version<>c.version or (u.external and c.state<>'invited') then raise exception 'STALE_VERSION';end if;
 if u.external and glf_kyc_private.token_case(p_token) is distinct from c.id then raise exception 'LINK_INVALID';end if;
 if u.committed then return true;end if;
 select metadata into m from storage.objects where bucket_id='glf-kyc-documents' and name=p_path;
 if m is null or (m->>'size')::bigint not between 1 and 10485760 or m->>'mimetype' not in('application/pdf','image/jpeg','image/png') or (u.slot in('signed','countersigned','report') and m->>'mimetype'<>'application/pdf') then raise exception 'INVALID_FILE';end if;
 insert into public.glf_kyc_files(case_id,slot,path,name,bytes,mime,version) values(u.case_id,u.slot,p_path,left(p_name,250),(m->>'size')::bigint,m->>'mimetype',c.version);
 update glf_kyc_private.uploads set committed=true where path=p_path;
 insert into public.glf_kyc_events(case_id,action,actor_id,detail) values(u.case_id,'file_attached',case when u.external then null else auth.uid() end,u.slot);return true;
end;$$;
create or replace function public.glf_kyc_upload_allowed(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from glf_kyc_private.uploads u join public.glf_kyc_cases c on c.id=u.case_id
 where u.path=p_path and not u.committed and u.expires_at>now() and u.version=c.version and u.edit_epoch=c.edit_epoch
 and ((u.external and c.state='invited' and not c.assisted and exists(select 1 from glf_kyc_private.invitations i where i.case_id=c.id and not i.revoked and i.expires_at>now()))
 or (not u.external and u.actor_id=auth.uid() and public.glf_kyc_allowed() and ((c.assisted and c.state in('draft','correction')) or (not c.assisted and c.state in('submitted','review','correction'))))));
$$;
revoke all on function public.glf_kyc_assist(uuid,integer,integer,text,jsonb,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.glf_kyc_assist(uuid,integer,integer,text,jsonb,text,boolean,boolean) to authenticated;
revoke all on function glf_kyc_private.audit_answers(),glf_kyc_private.expire_uploads() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
