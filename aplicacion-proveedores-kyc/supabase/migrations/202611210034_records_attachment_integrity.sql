-- F01: serialize pending uploads with approval and freeze dispatch attachment membership.
begin;
alter table glf_records_private.files add column upload_version integer, add column cancelled_at timestamptz;
-- Historical incomplete tickets deliberately require a new upload; confirmed files are untouched.
create function glf_records_private.guard_attachment_upload() returns trigger language plpgsql security definer set search_path='' as $$
declare d glf_records_private.documents;
begin
 select * into d from glf_records_private.documents where id=new.document_id for update;
 if d.direction='outgoing' and new.kind in('attachment','source') then
  if tg_op='INSERT' and not new.confirmed then new.upload_version:=d.version;
  elsif tg_op='UPDATE' and new.confirmed and not old.confirmed then
   if old.cancelled_at is not null or d.status<>'draft' or old.upload_version is distinct from d.version or old.created_at<=now()-interval '1 hour' then raise exception 'UPLOAD_NO_LONGER_VALID';end if;
   if old.uploaded_by is distinct from auth.uid() or d.author_id is distinct from auth.uid() or not glf_records_private.allowed('create') or not glf_records_private.readable(d.id) then raise exception 'FORBIDDEN';end if;
  end if;
 end if;return new;
end;$$;
create trigger records_guard_attachment_upload before insert or update of confirmed on glf_records_private.files for each row execute function glf_records_private.guard_attachment_upload();
revoke all on function glf_records_private.guard_attachment_upload() from public,anon,authenticated;

do $$begin
 execute replace(pg_get_functiondef('public.glf_records(text,uuid,integer,jsonb)'::regprocedure),'FUNCTION public.glf_records(','FUNCTION glf_records_private.core_v033(');
 execute replace(pg_get_functiondef('public.glf_records_file_allowed(text,boolean)'::regprocedure),'FUNCTION public.glf_records_file_allowed(','FUNCTION glf_records_private.file_allowed_v033(');
end;$$;
revoke all on function glf_records_private.core_v033(text,uuid,integer,jsonb),glf_records_private.file_allowed_v033(text,boolean) from public,anon,authenticated;
create or replace function public.glf_records_file_allowed(p_path text,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select glf_records_private.file_allowed_v033(p_path,p_write) and (not p_write or exists(select 1 from glf_records_private.files f join glf_records_private.documents d on d.id=f.document_id where f.path=p_path and f.cancelled_at is null and (d.direction<>'outgoing' or f.kind not in('attachment','source') or f.upload_version=d.version)));
$$;
create or replace function public.glf_records(p_action text,p_id uuid default null,p_version integer default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare d glf_records_private.documents; f glf_records_private.files; result jsonb;
begin
 if public.glf_is_active() is not true or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FORBIDDEN';end if;
 if p_action in('submit','approve','discard_pending_upload') then
  if not glf_records_private.readable(p_id) then raise exception 'FORBIDDEN';end if;
  select * into d from glf_records_private.documents where id=p_id for update;
  if d.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
  if p_action in('submit','discard_pending_upload') and (d.direction<>'outgoing' or d.status<>'draft' or d.author_id<>auth.uid() or not glf_records_private.allowed('create')) then raise exception 'FORBIDDEN_OR_STATE';end if;
  if p_action='approve' and (d.status<>'review' or d.signer_id<>auth.uid() or not glf_records_private.allowed('sign')) then raise exception 'FORBIDDEN_OR_STATE';end if;
  if p_action='discard_pending_upload' then
   select * into f from glf_records_private.files where id=(p_data->>'file_id')::uuid and document_id=p_id for update;
   if not found or f.confirmed or f.cancelled_at is not null or f.kind not in('attachment','source') then raise exception 'INVALID_PENDING_UPLOAD';end if;
   update glf_records_private.files set cancelled_at=now() where id=f.id;
   update glf_records_private.documents set version=version+1,updated_at=now() where id=p_id;
   insert into glf_records_private.events(document_id,actor_id,action,detail) values(p_id,auth.uid(),p_action,f.filename);
   return to_jsonb(p_id);
  end if;
  if exists(select 1 from glf_records_private.files where document_id=p_id and kind in('attachment','source') and not confirmed and cancelled_at is null) then raise exception 'PENDING_UPLOADS';end if;
 end if;
 result:=glf_records_private.core_v033(p_action,p_id,p_version,p_data);
 if p_action='read' then
  result:=result||jsonb_build_object('pending_uploads',coalesce((select jsonb_agg(jsonb_build_object('id',pf.id,'filename',pf.filename,'kind',pf.kind,'created_at',pf.created_at) order by pf.created_at,pf.id) from glf_records_private.files pf join glf_records_private.documents pd on pd.id=pf.document_id where pf.document_id=p_id and pd.direction='outgoing' and pd.status in('draft','review') and pf.kind in('attachment','source') and not pf.confirmed and pf.cancelled_at is null),'[]'));
 end if;return result;
end;$$;
revoke all on function public.glf_records(text,uuid,integer,jsonb),public.glf_records_file_allowed(text,boolean) from public,anon;
grant execute on function public.glf_records(text,uuid,integer,jsonb),public.glf_records_file_allowed(text,boolean) to authenticated;

create function glf_records_private.approved_dispatch_files(p_document uuid,p_signed uuid) returns uuid[] language plpgsql stable security definer set search_path='' as $$
declare r glf_records_private.revisions; ids uuid[]; n integer;
begin
 select * into r from glf_records_private.revisions where document_id=p_document order by version desc limit 1;
 if not found or jsonb_typeof(r.snapshot->'attachments') is distinct from 'array' then raise exception 'APPROVED_FILES_UNAVAILABLE';end if;
 if not exists(select 1 from glf_records_private.files f join glf_records_private.signature_reviews sr on sr.file_id=f.id where f.id=p_signed and f.document_id=p_document and f.kind='signed' and f.confirmed and f.revision_id=r.id) then raise exception 'APPROVED_FILES_UNAVAILABLE';end if;
 select coalesce(array_agg((x->>'id')::uuid),'{}'),count(*) into ids,n from jsonb_array_elements(r.snapshot->'attachments') x;
 if (select count(*) from glf_records_private.files where document_id=p_document and confirmed and kind='attachment' and id=any(ids))<>n then raise exception 'APPROVED_FILES_UNAVAILABLE';end if;
 return array_append(ids,p_signed);
end;$$;
revoke all on function glf_records_private.approved_dispatch_files(uuid,uuid) from public,anon,authenticated;

create or replace function public.glf_records_dispatch_worker(p_id uuid,p_action text,p_provider_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s glf_records_private.dispatches; d glf_records_private.documents; result jsonb; approved uuid[];begin
 select * into s from glf_records_private.dispatches where id=p_id for update;
 if not found or s.method<>'gmail' then raise exception 'NOT_FOUND';end if;
 select * into d from glf_records_private.documents where id=s.document_id for update;
 if p_action='claim' then
  if s.status<>'pending' or d.status<>'signed' then raise exception 'ALREADY_CLAIMED';end if;
  if not exists(select 1 from public.glf_profiles p where p.id=s.actor_id and p.active and (p.manage_users or exists(select 1 from glf_records_private.member_roles mr join glf_records_private.role_permissions rp on rp.role_id=mr.role_id where mr.user_id=p.id and rp.permission='dispatch'))) then raise exception 'FORBIDDEN';end if;
  if d.classification='restricted' and s.actor_id not in(d.author_id,coalesce(d.signer_id,d.author_id),coalesce(d.assigned_to,d.author_id)) and not exists(select 1 from glf_records_private.access a where a.document_id=d.id and a.user_id=s.actor_id) then raise exception 'FORBIDDEN';end if;
  approved:=glf_records_private.approved_dispatch_files(d.id,s.signed_file_id);
  select to_jsonb(s)||jsonb_build_object('files',jsonb_agg(jsonb_build_object('path',f.path,'filename',f.filename,'mime',f.mime,'size',f.size))) into result from glf_records_private.files f where f.document_id=d.id and f.confirmed and f.id=any(approved);
  if (select sum(size) from glf_records_private.files where document_id=d.id and confirmed and id=any(approved))>18874368 then raise exception 'MAIL_TOO_LARGE';end if;
  update glf_records_private.dispatches set status='sending' where id=p_id;return result;
 end if;
 if s.status<>'sending' or p_action not in('sent','failed','uncertain') then raise exception 'INVALID_STATE';end if;
 if p_action='sent' and length(coalesce(p_provider_id,''))=0 then raise exception 'PROVIDER_ID_REQUIRED';end if;
 update glf_records_private.dispatches set status=p_action,provider_id=left(p_provider_id,200),sent_at=case when p_action='sent' then now() end where id=p_id;
 if p_action='sent' then update glf_records_private.documents set status='sent',version=version+1,updated_at=now() where id=d.id;end if;
 insert into glf_records_private.events(document_id,actor_id,action) values(d.id,s.actor_id,'dispatch_'||p_action);return jsonb_build_object('status',p_action);
end;$$;

revoke all on function public.glf_records_dispatch_worker(uuid,text,text) from public,anon,authenticated;
grant execute on function public.glf_records_dispatch_worker(uuid,text,text) to service_role;
commit;
