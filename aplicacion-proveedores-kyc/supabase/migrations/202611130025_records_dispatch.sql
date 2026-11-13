begin;
create function public.glf_records_prepare_dispatch(p_id uuid,p_version integer,p_email text,p_subject text,p_message text,p_cc text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare d glf_records_private.documents; f uuid; v uuid;begin
 if not glf_records_private.readable(p_id) or not glf_records_private.allowed('dispatch') then raise exception 'FORBIDDEN';end if;
 select * into d from glf_records_private.documents where id=p_id for update;
 if d.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
 if d.status<>'signed' then raise exception 'INVALID_STATE';end if;
 if not glf_records_private.valid_emails(p_email) or not glf_records_private.valid_emails(p_cc,true) or length(trim(coalesce(p_subject,''))) not between 3 and 400 or p_subject ~ E'[\r\n]' or length(trim(coalesce(p_message,''))) not between 5 and 10000 then raise exception 'INVALID_MAIL';end if;
 select f1.id into f from glf_records_private.files f1 join glf_records_private.signature_reviews sr on sr.file_id=f1.id where f1.document_id=p_id and f1.confirmed order by f1.created_at desc limit 1;
 if f is null then raise exception 'SIGNED_FILE_REQUIRED';end if;
 -- A pending/ambiguous/sent attempt cannot be sent a second time. Client retries reuse pending only.
 select id into v from glf_records_private.dispatches where document_id=p_id and status='pending' and actor_id=auth.uid() and recipient_email=lower(trim(p_email)) and cc_email=lower(trim(coalesce(p_cc,''))) and subject=trim(p_subject) and message=p_message;
 if v is not null then return v;end if;
 insert into glf_records_private.dispatches(document_id,signed_file_id,actor_id,method,status,recipient_email,cc_email,subject,message) values(p_id,f,auth.uid(),'gmail','pending',lower(trim(p_email)),lower(trim(coalesce(p_cc,''))),trim(p_subject),p_message) returning id into v;
 insert into glf_records_private.events(document_id,actor_id,action) values(p_id,auth.uid(),'dispatch_prepared');return v;
end;$$;
create function public.glf_records_dispatch_worker(p_id uuid,p_action text,p_provider_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare s glf_records_private.dispatches; d glf_records_private.documents; result jsonb;begin
 select * into s from glf_records_private.dispatches where id=p_id for update;
 if not found or s.method<>'gmail' then raise exception 'NOT_FOUND';end if;
 select * into d from glf_records_private.documents where id=s.document_id for update;
 if p_action='claim' then
  if s.status<>'pending' or d.status<>'signed' then raise exception 'ALREADY_CLAIMED';end if;
  if not exists(select 1 from public.glf_profiles p where p.id=s.actor_id and p.active and (p.manage_users or exists(select 1 from glf_records_private.member_roles mr join glf_records_private.role_permissions rp on rp.role_id=mr.role_id where mr.user_id=p.id and rp.permission='dispatch'))) then raise exception 'FORBIDDEN';end if;
  if d.classification='restricted' and s.actor_id not in(d.author_id,coalesce(d.signer_id,d.author_id),coalesce(d.assigned_to,d.author_id)) and not exists(select 1 from glf_records_private.access a where a.document_id=d.id and a.user_id=s.actor_id) then raise exception 'FORBIDDEN';end if;
  select to_jsonb(s)||jsonb_build_object('files',jsonb_agg(jsonb_build_object('path',f.path,'filename',f.filename,'mime',f.mime,'size',f.size))) into result from glf_records_private.files f where f.document_id=d.id and f.confirmed and (f.id=s.signed_file_id or f.kind='attachment');
  if (select sum(size) from glf_records_private.files where document_id=d.id and confirmed and (id=s.signed_file_id or kind='attachment'))>18874368 then raise exception 'MAIL_TOO_LARGE';end if;
  update glf_records_private.dispatches set status='sending' where id=p_id;return result;
 end if;
 if s.status<>'sending' or p_action not in('sent','failed','uncertain') then raise exception 'INVALID_STATE';end if;
 if p_action='sent' and length(coalesce(p_provider_id,''))=0 then raise exception 'PROVIDER_ID_REQUIRED';end if;
 update glf_records_private.dispatches set status=p_action,provider_id=left(p_provider_id,200),sent_at=case when p_action='sent' then now() end where id=p_id;
 if p_action='sent' then update glf_records_private.documents set status='sent',version=version+1,updated_at=now() where id=d.id;end if;
 insert into glf_records_private.events(document_id,actor_id,action) values(d.id,s.actor_id,'dispatch_'||p_action);return jsonb_build_object('status',p_action);
end;$$;
revoke all on function public.glf_records_prepare_dispatch(uuid,integer,text,text,text,text),public.glf_records_dispatch_worker(uuid,text,text) from public,anon,authenticated;
grant execute on function public.glf_records_prepare_dispatch(uuid,integer,text,text,text,text) to authenticated;
-- Supabase provides service_role. Test installations without that role receive no worker grant.
do $$begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.glf_records_dispatch_worker(uuid,text,text) to service_role;end if;end;$$;
commit;
