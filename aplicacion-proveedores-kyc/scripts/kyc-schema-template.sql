-- KYC pilot. Private case data; explicit permission independent of supplier editing.
begin;
alter table public.glf_profiles add column kyc_role text not null default 'none' check(kyc_role in('none','manager','delegate')),
 add column kyc_until timestamptz;
create schema if not exists glf_kyc_private;
revoke all on schema glf_kyc_private from public,anon,authenticated;
create function public.glf_kyc_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select public.glf_is_active() and auth.jwt()->>'aal'='aal2' and coalesce((select kyc_role='manager' or (kyc_role='delegate' and kyc_until>now()) from public.glf_profiles where id=auth.uid()),false);
$$;
create table public.glf_kyc_cases(
 id uuid primary key default gen_random_uuid(),code bigint generated always as identity unique,
 supplier_id uuid references public.glf_suppliers(id), name text not null check(length(name) between 1 and 250),email text not null check(length(email)<=250 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 relation text not null check(relation in('supplier','consultant','staff','board')),
 answers jsonb not null default '{}' check(jsonb_typeof(answers)='object' and octet_length(answers::text)<=100000),
 form_version text not null default '2026-10-25.1',version integer not null default 1,pdf_version integer,
 state text not null default 'draft' check(state in('draft','invited','submitted','review','correction','approved','not_approved')),
 allow_scan boolean not null default false, note text not null default '',receipt_at timestamptz,review_note text not null default '',
 created_by uuid not null references public.glf_profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(supplier_id is null or relation in('supplier','consultant'))
);
create unique index glf_kyc_one_open_supplier on public.glf_kyc_cases(supplier_id) where state not in('approved','not_approved');
create table glf_kyc_private.invitations(case_id uuid primary key references public.glf_kyc_cases(id),token_hash bytea not null unique,expires_at timestamptz not null,revoked boolean not null default false);
create table public.glf_kyc_files(id uuid primary key default gen_random_uuid(),case_id uuid not null references public.glf_kyc_cases(id),slot text not null,path text not null unique,name text not null,bytes bigint not null,mime text not null,version integer not null,created_at timestamptz not null default now(),check(length(name)<=250));
create table glf_kyc_private.uploads(path text primary key,case_id uuid references public.glf_kyc_cases(id),slot text not null,version integer not null,expires_at timestamptz not null,committed boolean not null default false,external boolean not null default true);
create table public.glf_kyc_events(id uuid primary key default gen_random_uuid(),case_id uuid not null references public.glf_kyc_cases(id),action text not null,actor_id uuid,created_at timestamptz not null default now(),detail text not null default '');
create table glf_kyc_private.submissions(id uuid primary key default gen_random_uuid(),case_id uuid references public.glf_kyc_cases(id),version integer,answers jsonb,files jsonb,created_at timestamptz default now());
alter table public.glf_kyc_cases enable row level security;
alter table public.glf_kyc_files enable row level security;
alter table public.glf_kyc_events enable row level security;
alter table glf_kyc_private.invitations enable row level security;
alter table glf_kyc_private.uploads enable row level security;
alter table glf_kyc_private.submissions enable row level security;
revoke all on public.glf_kyc_cases,public.glf_kyc_files,public.glf_kyc_events from public,anon,authenticated;
grant select on public.glf_kyc_cases,public.glf_kyc_files,public.glf_kyc_events to authenticated;
create policy kyc_private_cases on public.glf_kyc_cases for select to authenticated using(public.glf_kyc_allowed());
create policy kyc_private_files on public.glf_kyc_files for select to authenticated using(public.glf_kyc_allowed());
create policy kyc_private_events on public.glf_kyc_events for select to authenticated using(public.glf_kyc_allowed());
create function glf_kyc_private.token_case(p_token text) returns uuid language sql stable security definer set search_path='' as $$
 select i.case_id from glf_kyc_private.invitations i join public.glf_kyc_cases c on c.id=i.case_id where length(p_token)=64 and i.token_hash=sha256(convert_to(p_token,'UTF8')) and not i.revoked and i.expires_at>now() and c.state='invited';
$$;
-- MODEL_FUNCTIONS
create function public.glf_kyc_create(p_supplier uuid,p_name text,p_email text,p_relation text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;s public.glf_suppliers;a jsonb;
begin
 if not public.glf_kyc_allowed() then raise exception 'FORBIDDEN';end if;
 if p_supplier is not null then select * into s from public.glf_suppliers where id=p_supplier and active;if not found then raise exception 'INVALID_SUPPLIER';end if;end if;
 a=jsonb_build_object('relation',p_relation,'name',trim(p_name),'email',lower(trim(p_email)),'country',coalesce(s.id_country_code,s.country_code,'EC'),'residenceCountry',coalesce(s.country_code,'EC'),'person',coalesce(s.person_type,'natural'),'id',case when s.person_type='natural' and s.id_type='ruc' then left(s.id_number,10) else coalesce(s.id_number,'') end,'idType',coalesce(s.id_type,'cedula'),'phone',coalesce(s.phone,''),'city',coalesce(s.city,''),'address',coalesce(s.address,''),'taxId',coalesce(nullif(s.tax_number,''),case when s.id_type='ruc' then s.id_number else '' end),'invoice',case when s.person_type='natural' and (s.id_type='ruc' or s.tax_number<>'') then 'yes' else '' end,'nationalityType',case when coalesce(s.country_code,'EC')='EC' then 'national' else 'international' end,'legalRep',coalesce(s.legal_rep_name,''),'activity',coalesce(s.description,''),'services',coalesce(s.description,''),'owners','[]'::jsonb);
 insert into public.glf_kyc_cases(supplier_id,name,email,relation,answers,created_by) values(p_supplier,trim(p_name),lower(trim(p_email)),p_relation,glf_kyc_private.project(a),auth.uid()) returning id into v_id;
 insert into public.glf_kyc_events(case_id,action,actor_id) values(v_id,'created',auth.uid());return v_id;
end;$$;
create function public.glf_kyc_invite(p_id uuid,p_scan boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.glf_kyc_cases;tok text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');expiry timestamptz:=now()+interval '7 days';
begin
 if not public.glf_kyc_allowed() then raise exception 'FORBIDDEN';end if;
 select * into c from public.glf_kyc_cases where id=p_id for update;
 if not found or c.state not in('draft','invited','correction') then raise exception 'INVALID_STATE';end if;
 insert into glf_kyc_private.invitations(case_id,token_hash,expires_at) values(p_id,sha256(convert_to(tok,'UTF8')),expiry) on conflict(case_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,revoked=false;
 update public.glf_kyc_cases set state='invited',allow_scan=p_scan,updated_at=now() where id=p_id;
 insert into public.glf_kyc_events(case_id,action,actor_id,detail) values(p_id,'invitation_issued',auth.uid(),expiry::text);
 return jsonb_build_object('token',tok,'expires_at',expiry);
end;$$;
create function public.glf_kyc_read(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=glf_kyc_private.token_case(p_token);c public.glf_kyc_cases;
begin
 if cid is null then raise exception 'LINK_INVALID';end if;select * into c from public.glf_kyc_cases where id=cid;
 return jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'relation',c.relation,'answers',c.answers,'version',c.version,'pdf_version',c.pdf_version,'form_version',c.form_version,'allow_scan',c.allow_scan,'note',c.note,'expires_at',(select expires_at from glf_kyc_private.invitations where case_id=cid),'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'slot',f.slot,'name',f.name,'bytes',f.bytes,'version',f.version)) from public.glf_kyc_files f where f.case_id=cid and f.version=c.version),'[]'::jsonb));
end;$$;
create function public.glf_kyc_save(p_token text,p_version integer,p_answers jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare cid uuid:=glf_kyc_private.token_case(p_token);c public.glf_kyc_cases;a jsonb;
begin
 if cid is null then raise exception 'LINK_INVALID';end if;select * into c from public.glf_kyc_cases where id=cid for update;
 if c.state<>'invited' or glf_kyc_private.token_case(p_token) is distinct from cid then raise exception 'LINK_INVALID';end if;
 if c.version<>p_version then raise exception 'STALE_VERSION';end if;
 if jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>100000 then raise exception 'INVALID';end if;
 a=glf_kyc_private.project(p_answers);if a->>'relation' is distinct from c.relation then raise exception 'ROUTE_MISMATCH';end if;
 if c.answers=a then return c.version;end if;
 update public.glf_kyc_cases set answers=a,version=version+1,pdf_version=null,updated_at=now() where id=cid returning version into p_version;
 return p_version;
end;$$;
create function public.glf_kyc_prepare_pdf(p_token text,p_version integer) returns boolean language plpgsql security definer set search_path='' as $$
declare cid uuid:=glf_kyc_private.token_case(p_token);c public.glf_kyc_cases;
begin
 if cid is null then raise exception 'LINK_INVALID';end if;select * into c from public.glf_kyc_cases where id=cid for update;
 if glf_kyc_private.token_case(p_token) is distinct from cid then raise exception 'LINK_INVALID';end if;
 if c.version<>p_version then raise exception 'STALE_VERSION';end if;
 if array_length(glf_kyc_private.validate(c.answers),1)>0 then raise exception 'INCOMPLETE_FORM';end if;
 update public.glf_kyc_cases set pdf_version=version where id=cid;return true;
end;$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('glf-kyc-documents','glf-kyc-documents',false,10485760,array['application/pdf','image/jpeg','image/png']);
create function public.glf_kyc_upload_allowed(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from glf_kyc_private.uploads u join public.glf_kyc_cases c on c.id=u.case_id where u.path=p_path and not u.committed and u.expires_at>now() and u.version=c.version and ((u.external and c.state='invited') or (not u.external and public.glf_kyc_allowed())));
$$;
create policy kyc_upload_ticket on storage.objects for insert to anon,authenticated with check(bucket_id='glf-kyc-documents' and public.glf_kyc_upload_allowed(name));
create policy kyc_private_download on storage.objects for select to authenticated using(bucket_id='glf-kyc-documents' and public.glf_kyc_allowed() and exists(select 1 from public.glf_kyc_files f where f.path=name));
create function public.glf_kyc_upload_ticket(p_token text,p_id uuid,p_version integer,p_slot text) returns text language plpgsql security definer set search_path='' as $$
declare cid uuid;c public.glf_kyc_cases;path text;ext boolean:=p_token is not null;
begin
 if ext then cid=glf_kyc_private.token_case(p_token);else if not public.glf_kyc_allowed() then raise exception 'FORBIDDEN';end if;cid=p_id;end if;
 if cid is null then raise exception 'LINK_INVALID';end if;select * into c from public.glf_kyc_cases where id=cid for update;
 if not found or c.version<>p_version then raise exception 'STALE_VERSION';end if;
 if ext and (glf_kyc_private.token_case(p_token) is distinct from cid or p_slot not in(select unnest(glf_kyc_private.documents(c.answers)))) then raise exception 'INVALID_SLOT';end if;
 if not ext and (p_slot not in('report','countersigned','other') or c.state not in('submitted','review','correction')) then raise exception 'INVALID_SLOT';end if;
 if p_slot='signed' and c.pdf_version is distinct from c.version then raise exception 'PDF_REQUIRED';end if;
 if (select count(*) from public.glf_kyc_files where case_id=cid)>=200 then raise exception 'UPLOAD_LIMIT';end if;
 if (select coalesce(sum(bytes),0) from public.glf_kyc_files where case_id=cid)>157286400 then raise exception 'UPLOAD_LIMIT';end if;
 if (select count(*) from glf_kyc_private.uploads where case_id=cid and expires_at>now() and not committed)>50 then raise exception 'UPLOAD_LIMIT';end if;
 path=cid::text||'/'||gen_random_uuid()::text;
 insert into glf_kyc_private.uploads values(path,cid,p_slot,c.version,now()+interval '15 minutes',false,ext);return path;
end;$$;
create function public.glf_kyc_attach(p_token text,p_path text,p_name text) returns boolean language plpgsql security definer set search_path='' as $$
declare u glf_kyc_private.uploads;c public.glf_kyc_cases;m jsonb;
begin
 select * into u from glf_kyc_private.uploads where path=p_path for update;if not found then raise exception 'INVALID_UPLOAD';end if;
 if u.external then if glf_kyc_private.token_case(p_token) is distinct from u.case_id then raise exception 'LINK_INVALID';end if;else if not public.glf_kyc_allowed() then raise exception 'FORBIDDEN';end if;end if;
 select * into c from public.glf_kyc_cases where id=u.case_id for update;
 if u.expires_at<now() or u.version<>c.version or (u.external and c.state<>'invited') then raise exception 'STALE_VERSION';end if;
 if u.committed then return true;end if;
 select metadata into m from storage.objects where bucket_id='glf-kyc-documents' and name=p_path;
 if m is null or (m->>'size')::bigint not between 1 and 10485760 or m->>'mimetype' not in('application/pdf','image/jpeg','image/png') or (u.slot in('signed','countersigned','report') and m->>'mimetype'<>'application/pdf') then raise exception 'INVALID_FILE';end if;
 insert into public.glf_kyc_files(case_id,slot,path,name,bytes,mime,version) values(u.case_id,u.slot,p_path,left(p_name,250),(m->>'size')::bigint,m->>'mimetype',c.version);
 update glf_kyc_private.uploads set committed=true where path=p_path;
 insert into public.glf_kyc_events(case_id,action,actor_id,detail) values(u.case_id,'file_attached',case when u.external then null else auth.uid() end,u.slot);return true;
end;$$;
create function public.glf_kyc_submit(p_token text,p_version integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=glf_kyc_private.token_case(p_token);c public.glf_kyc_cases;k text;
begin
 if cid is null then raise exception 'LINK_INVALID';end if;select * into c from public.glf_kyc_cases where id=cid for update;
 if glf_kyc_private.token_case(p_token) is distinct from cid then raise exception 'LINK_INVALID';end if;
 if c.version<>p_version then raise exception 'STALE_VERSION';end if;
 if c.pdf_version is distinct from c.version or array_length(glf_kyc_private.validate(c.answers),1)>0 then raise exception 'INCOMPLETE_FORM';end if;
 foreach k in array glf_kyc_private.documents(c.answers) loop
  if not exists(select 1 from public.glf_kyc_files f where f.case_id=cid and f.slot=k and f.version=c.version) then raise exception 'MISSING_DOCUMENT';end if;
 end loop;
 insert into glf_kyc_private.submissions(case_id,version,answers,files) values(cid,c.version,c.answers,(select jsonb_agg(to_jsonb(f)) from public.glf_kyc_files f where f.case_id=cid and f.version=c.version));
 update public.glf_kyc_cases set state='submitted',receipt_at=now(),updated_at=now() where id=cid;
 update glf_kyc_private.invitations set revoked=true where case_id=cid;
 insert into public.glf_kyc_events(case_id,action,detail) values(cid,'submitted','Pending human review');
 return jsonb_build_object('code',c.code,'received_at',now(),'version',c.version);
end;$$;
create function public.glf_kyc_review(p_id uuid,p_state text,p_note text,p_confirm boolean default false) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.glf_kyc_cases;
begin
 if not public.glf_kyc_allowed() then raise exception 'FORBIDDEN';end if;select * into c from public.glf_kyc_cases where id=p_id for update;
 if not found or c.state not in('submitted','review','correction') or p_state not in('review','correction','approved','not_approved') or length(trim(p_note)) not between 5 and 5000 then raise exception 'INVALID_REVIEW';end if;
 if p_state in('approved','not_approved') and (not p_confirm or not exists(select 1 from public.glf_kyc_files where case_id=p_id and slot='report' and version=c.version)) then raise exception 'REPORT_REQUIRED';end if;
 if p_state='approved' and not exists(select 1 from public.glf_kyc_files where case_id=p_id and slot='countersigned' and version=c.version) then raise exception 'COUNTERSIGN_REQUIRED';end if;
 update public.glf_kyc_cases set state=p_state,review_note=trim(p_note),note=case when p_state='correction' then trim(p_note) else note end,updated_at=now() where id=p_id;
 insert into public.glf_kyc_events(case_id,action,actor_id,detail) values(p_id,p_state,auth.uid(),trim(p_note));return true;
end;$$;

create table public.glf_kyc_delegation_audit(id uuid primary key default gen_random_uuid(),actor_id uuid not null,target_id uuid not null,until_at timestamptz,reason text not null,created_at timestamptz not null default now());
alter table public.glf_kyc_delegation_audit enable row level security;
revoke all on public.glf_kyc_delegation_audit from public,anon,authenticated;
grant select on public.glf_kyc_delegation_audit to authenticated;
create policy kyc_delegation_read on public.glf_kyc_delegation_audit for select to authenticated using(public.glf_kyc_allowed() and exists(select 1 from public.glf_profiles where id=auth.uid() and kyc_role='manager'));
create function public.glf_kyc_users() returns table(id uuid,display_name text,kyc_role text,kyc_until timestamptz) language plpgsql security definer set search_path='' as $$
begin
 if not public.glf_kyc_allowed() or not exists(select 1 from public.glf_profiles p where p.id=auth.uid() and p.kyc_role='manager') then raise exception 'FORBIDDEN';end if;
 return query select p.id,p.display_name,p.kyc_role,p.kyc_until from public.glf_profiles p where p.active and p.id<>auth.uid() and p.kyc_role<>'manager' order by p.display_name;
end;$$;
create function public.glf_kyc_delegate(p_target uuid,p_until timestamptz,p_reason text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.glf_kyc_allowed() or not exists(select 1 from public.glf_profiles where id=auth.uid() and kyc_role='manager') then raise exception 'FORBIDDEN';end if;
 if p_target=auth.uid() or length(trim(p_reason)) not between 5 and 1000 or (p_until is not null and (p_until<=now() or p_until>now()+interval '30 days')) then raise exception 'INVALID_DELEGATION';end if;
 update public.glf_profiles set kyc_role=case when p_until is null then 'none' else 'delegate' end,kyc_until=p_until where id=p_target and active and kyc_role<>'manager';
 if not found then raise exception 'INVALID_DELEGATION';end if;
 insert into public.glf_kyc_delegation_audit(actor_id,target_id,until_at,reason) values(auth.uid(),p_target,p_until,trim(p_reason));return true;
end;$$;


create function public.glf_kyc_configure(p_id uuid,p_name text,p_email text,p_relation text) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.glf_kyc_cases;
begin
 if not public.glf_kyc_allowed() then raise exception 'FORBIDDEN';end if;
 select * into c from public.glf_kyc_cases where id=p_id for update;
 if not found or c.state not in('draft','invited','correction') then raise exception 'INVALID_STATE';end if;
 update public.glf_kyc_cases set name=trim(p_name),email=lower(trim(p_email)),relation=p_relation,supplier_id=case when p_relation in('staff','board') then null else supplier_id end,answers=glf_kyc_private.project(answers||jsonb_build_object('name',trim(p_name),'email',lower(trim(p_email)),'relation',p_relation)),state='draft',version=version+1,pdf_version=null,updated_at=now() where id=p_id;
 update glf_kyc_private.invitations set revoked=true where case_id=p_id;
 insert into public.glf_kyc_events(case_id,action,actor_id) values(p_id,'invitation_corrected',auth.uid());return true;
end;$$;
create function public.glf_kyc_link_supplier(p_id uuid,p_supplier uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.glf_kyc_allowed() then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.glf_suppliers where id=p_supplier and active) then raise exception 'INVALID_SUPPLIER';end if;
 update public.glf_kyc_cases set supplier_id=p_supplier,updated_at=now() where id=p_id and relation in('supplier','consultant') and supplier_id is null;
 if not found then raise exception 'INVALID_STATE';end if;
 insert into public.glf_kyc_events(case_id,action,actor_id) values(p_id,'supplier_linked',auth.uid());return true;
end;$$;

-- All functions are explicitly opted in; internal helpers are never RPC endpoints.
revoke all on all functions in schema glf_kyc_private from public,anon,authenticated;
DO $do$ declare f record;begin for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'glf_kyc_%' loop execute 'revoke all on function '||f.signature||' from public,anon,authenticated';end loop;end $do$;
grant execute on function public.glf_kyc_allowed(),public.glf_kyc_create(uuid,text,text,text),public.glf_kyc_invite(uuid,boolean),public.glf_kyc_review(uuid,text,text,boolean),public.glf_kyc_configure(uuid,text,text,text),public.glf_kyc_link_supplier(uuid,uuid),public.glf_kyc_users(),public.glf_kyc_delegate(uuid,timestamptz,text) to authenticated;
grant execute on function public.glf_kyc_read(text),public.glf_kyc_save(text,integer,jsonb),public.glf_kyc_prepare_pdf(text,integer),public.glf_kyc_upload_allowed(text),public.glf_kyc_upload_ticket(text,uuid,integer,text),public.glf_kyc_attach(text,text,text),public.glf_kyc_submit(text,integer) to anon,authenticated;
commit;
