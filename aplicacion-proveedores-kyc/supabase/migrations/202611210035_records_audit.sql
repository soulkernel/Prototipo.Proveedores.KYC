-- Remaining approved audit corrections. Institutional names stay immutable.
begin;
alter table glf_records_private.files add column withdrawn_at timestamptz;
alter table glf_records_private.documents add column replaces_id uuid references glf_records_private.documents(id);
create unique index records_one_replacement on glf_records_private.documents(replaces_id) where replaces_id is not null;
alter table glf_records_private.parties add column administrative boolean not null default true;
-- Retain the supplier reference, but own the documentary identity and contacts.
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='glf_records_private.parties'::regclass and contype='c' and pg_get_constraintdef(oid) like '%supplier_id%' loop execute format('alter table glf_records_private.parties drop constraint %I',c.conname);end loop;
end;$$;
update glf_records_private.parties p set name=s.legal_name,kind=case when s.person_type='legal' then 'institution' else 'natural' end,address=coalesce(s.address,''),administrative=false from public.glf_suppliers s where p.supplier_id=s.id;
insert into glf_records_private.contacts(party_id,name,job_title,email,phone,is_representative)
 select p.id,coalesce(nullif(s.legal_rep_name,''),nullif(s.contact_name,''),s.legal_name),coalesce(s.contact_role,''),coalesce(s.email,''),coalesce(s.phone,''),p.kind='institution'
 from glf_records_private.parties p join public.glf_suppliers s on s.id=p.supplier_id where not exists(select 1 from glf_records_private.contacts c where c.party_id=p.id and c.active);
alter table glf_records_private.parties alter column name set not null,alter column kind set not null;
create or replace function glf_records_private.party(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(p)||jsonb_build_object('contacts',coalesce((select jsonb_agg(to_jsonb(c) order by c.active desc,c.is_representative desc,c.name,c.id) from glf_records_private.contacts c where c.party_id=p.id),'[]')) from glf_records_private.parties p where p.id=p_id;
$$;
-- Application entry points remain protected; private implementations cannot be called directly.
do $$begin
 execute replace(pg_get_functiondef('public.glf_records(text,uuid,integer,jsonb)'::regprocedure),'FUNCTION public.glf_records(','FUNCTION glf_records_private.core_v034(');
 execute replace(pg_get_functiondef('glf_records_private.payload(uuid)'::regprocedure),'FUNCTION glf_records_private.payload(','FUNCTION glf_records_private.payload_v034(');
end;$$;
revoke all on function glf_records_private.core_v034(text,uuid,integer,jsonb),glf_records_private.payload_v034(uuid) from public,anon,authenticated;
create or replace function glf_records_private.payload(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select glf_records_private.payload_v034(p_id)||jsonb_build_object('files',coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at desc,f.id) from glf_records_private.files f where f.document_id=p_id and f.confirmed and f.withdrawn_at is null),'[]'));
$$;
create function glf_records_private.prevent_institution_rename() returns trigger language plpgsql set search_path='' as $$begin
 if old.kind='institution' and new.name is distinct from old.name then raise exception 'NEW_INSTITUTION_REQUIRED';end if;return new;
end;$$;
create trigger records_institution_name before update of name on glf_records_private.parties for each row execute function glf_records_private.prevent_institution_rename();
revoke all on function glf_records_private.prevent_institution_rename() from public,anon,authenticated;
create or replace function glf_records_private.list_v035(p_action text,p_id uuid default null,p_version integer default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare states text[]:='{}'; view_name text:=coalesce(p_data->>'view','all'); direction_name text:=coalesce(p_data->>'direction',''); result jsonb;
begin
 if public.glf_is_active() is not true or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FORBIDDEN';end if;
 if p_action<>'list' then return glf_records_private.core_v034(p_action,p_id,p_version,p_data);end if;
 if direction_name not in('','incoming','outgoing') then raise exception 'INVALID_DIRECTION';end if;
 if view_name<>'all' then
  if direction_name='incoming' and view_name='attention' then states:=array['received','assigned'];
  elsif direction_name='incoming' and view_name='closed' then states:=array['closed'];
  elsif direction_name='outgoing' and view_name='drafts' then states:=array['draft'];
  elsif direction_name='outgoing' and view_name='signature' then states:=array['review','prepared'];
  elsif direction_name='outgoing' and view_name='dispatch' then states:=array['signed'];
  elsif direction_name='outgoing' and view_name='sent' then states:=array['sent'];
  else raise exception 'INVALID_VIEW';end if;
 end if;
 if nullif(p_data->>'date_from','')::date > nullif(p_data->>'date_to','')::date then raise exception 'INVALID_DATE';end if;
 with filtered as materialized (
  select dd.* from glf_records_private.documents dd
   where glf_records_private.readable(dd.id)
    and (coalesce(p_data->>'direction','')='' or dd.direction=p_data->>'direction')
    and (cardinality(states)=0 or dd.status=any(states))
    and (coalesce(p_data->>'status','')='' or dd.status=p_data->>'status')
    and (nullif(p_data->>'person_id','') is null or case when dd.direction='incoming' then dd.assigned_to else dd.author_id end=(p_data->>'person_id')::uuid)
    and (nullif(p_data->>'signer_id','') is null or dd.signer_id=(p_data->>'signer_id')::uuid)
    and (nullif(p_data->>'date_from','') is null or case when dd.direction='incoming' then (dd.received_at at time zone 'Pacific/Galapagos')::date else dd.document_date end >= (p_data->>'date_from')::date)
    and (nullif(p_data->>'date_to','') is null or case when dd.direction='incoming' then (dd.received_at at time zone 'Pacific/Galapagos')::date else dd.document_date end <= (p_data->>'date_to')::date)
    and (coalesce(p_data->>'deadline','')='' or (dd.status not in('closed','cancelled') and dd.due_date is not null and case when p_data->>'deadline'='overdue' then dd.due_date<(now() at time zone 'Pacific/Galapagos')::date else dd.due_date>=(now() at time zone 'Pacific/Galapagos')::date end))
    and (concat_ws(' ',dd.subject,dd.external_number,dd.internal_number) ilike '%'||left(coalesce(p_data->>'q',''),200)||'%'
     or exists(select 1 from glf_records_private.recipients rr join glf_records_private.parties pp on pp.id=rr.party_id left join public.glf_suppliers s on s.id=pp.supplier_id left join glf_records_private.contacts c on c.id=rr.contact_id where rr.document_id=dd.id and concat_ws(' ',coalesce(rr.snapshot->'party'->>'name',pp.name),coalesce(rr.snapshot->'contact'->>'name',c.name),coalesce(rr.snapshot->'contact'->>'job_title',c.job_title)) ilike '%'||left(coalesce(p_data->>'q',''),200)||'%'))

 ), page as (
  select dd.id,dd.direction,dd.subject,dd.status,dd.classification,dd.document_date,dd.received_at,dd.internal_number,dd.external_number,dd.year,dd.sequence,dd.due_date,dd.version,dd.author_id,dd.updated_at,
   (select display_name from public.glf_profiles where id=dd.author_id) author_name,
   (select display_name from public.glf_profiles where id=dd.assigned_to) assigned_name,
   (select string_agg(concat_ws(' — ',coalesce(rr.snapshot->'party'->>'name',pp.name),coalesce(rr.snapshot->'contact'->>'name',(select c.name from glf_records_private.contacts c where c.id=rr.contact_id))),' · ') from glf_records_private.recipients rr join glf_records_private.parties pp on pp.id=rr.party_id left join public.glf_suppliers s on s.id=pp.supplier_id where rr.document_id=dd.id and rr.kind in('to','from')) correspondent
  from filtered dd order by dd.updated_at desc,dd.id limit 50 offset greatest(0,least(coalesce((p_data->>'offset')::int,0),100000))
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.updated_at desc,p.id) from page p),'[]'),
  'total',(select count(*) from filtered),
  'draft_count',(select count(*) from glf_records_private.documents d where d.direction='outgoing' and d.status='draft' and glf_records_private.readable(d.id))) into result;
 return result;
end;$$;
revoke all on function glf_records_private.list_v035(text,uuid,integer,jsonb) from public,anon,authenticated;
create or replace function public.glf_records(p_action text,p_id uuid default null,p_version integer default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare d glf_records_private.documents; p glf_records_private.parties; f glf_records_private.files; s public.glf_suppliers; result jsonb; before_data jsonb; v uuid; reason text:=trim(coalesce(p_data->>'reason','')); pending boolean; x jsonb;
begin
 if public.glf_is_active() is not true or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FORBIDDEN';end if;
 if p_action='list' then return glf_records_private.list_v035(p_action,p_id,p_version,p_data);end if;
 if p_action in('parties','parties_export') then
  return coalesce((select jsonb_agg(glf_records_private.party(z.id) order by z.name,z.id) from (select pp.id,pp.name from glf_records_private.parties pp where pp.name ilike '%'||left(coalesce(p_data->>'q',''),200)||'%' or exists(select 1 from glf_records_private.contacts c where c.party_id=pp.id and concat_ws(' ',c.name,c.email) ilike '%'||left(coalesce(p_data->>'q',''),200)||'%') order by pp.name,pp.id limit case when p_action='parties' then 50 else null end offset case when p_action='parties' then greatest(0,least(coalesce((p_data->>'offset')::int,0),100000)) else 0 end) z),'[]');
 end if;
 if p_action='party' and nullif(p_data->>'supplier_id','') is not null then
  if not glf_records_private.allowed('contacts') then raise exception 'FORBIDDEN';end if;
  select * into s from public.glf_suppliers where id=(p_data->>'supplier_id')::uuid for share;
  if not found then raise exception 'NOT_FOUND';end if;
  select * into p from glf_records_private.parties where supplier_id=s.id;
  if found then return glf_records_private.party(p.id);end if;
  insert into glf_records_private.parties(supplier_id,kind,name,address,administrative) values(s.id,case when s.person_type='legal' then 'institution' else 'natural' end,s.legal_name,coalesce(s.address,''),false) on conflict(supplier_id) do nothing returning id into v;
  if v is null then select id into v from glf_records_private.parties where supplier_id=s.id;return glf_records_private.party(v);end if;
  insert into glf_records_private.contacts(party_id,name,job_title,email,phone,is_representative) values(v,coalesce(nullif(s.legal_rep_name,''),nullif(s.contact_name,''),s.legal_name),coalesce(s.contact_role,''),coalesce(s.email,''),coalesce(s.phone,''),s.person_type='legal');
  result:=glf_records_private.party(v);insert into glf_records_private.directory_events(party_id,actor_id,action,before_data,after_data) values(v,auth.uid(),'created','{}',result);return result;
 end if;
 if p_action in('directory_update','supplier_preview','supplier_refresh') then
  if not glf_records_private.allowed('contacts') then raise exception 'FORBIDDEN';end if;
  select * into p from glf_records_private.parties where id=p_id for update;if not found then raise exception 'NOT_FOUND';end if;
  if p.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
  before_data:=glf_records_private.party(p_id);
  if p_action in('supplier_preview','supplier_refresh') then
   select * into s from public.glf_suppliers where id=p.supplier_id for share;if not found then raise exception 'NOT_FOUND';end if;
   -- Name and authority are never overwritten by a commercial refresh.
   if p_action='supplier_preview' then return jsonb_build_object('address',s.address,'name',s.legal_name,'contact_name',s.contact_name,'email',s.email,'phone',s.phone,'supplier_version',s.version);end if;
   if s.version is distinct from (p_data->>'supplier_version')::integer then raise exception 'STALE_VERSION';end if;
   if coalesce((p_data->>'address')::boolean,false) then update glf_records_private.parties set address=coalesce(s.address,'') where id=p_id;end if;
   if coalesce((p_data->>'add_contact')::boolean,false) then
    if coalesce(nullif(s.contact_name,''),s.legal_name) is null then raise exception 'INVALID_CONTACT';end if;
    if not exists(select 1 from glf_records_private.contacts where party_id=p_id and active and name=coalesce(nullif(s.contact_name,''),s.legal_name) and email=coalesce(s.email,'') and phone=coalesce(s.phone,'')) then
     insert into glf_records_private.contacts(party_id,name,job_title,email,phone,is_representative) values(p_id,coalesce(nullif(s.contact_name,''),s.legal_name),coalesce(s.contact_role,''),coalesce(s.email,''),coalesce(s.phone,''),false);
    end if;
   end if;
  else
   if p.kind='institution' and p_data ? 'name' and p_data->>'name' is distinct from p.name then raise exception 'NEW_INSTITUTION_REQUIRED';end if;
   if length(coalesce(p_data->>'address',''))>1000 then raise exception 'INVALID_DIRECTORY';end if;
   update glf_records_private.parties set address=trim(coalesce(p_data->>'address',address)),administrative=coalesce((p_data->>'administrative')::boolean,administrative) where id=p_id;
   if p.kind='natural' and p_data ? 'name' then update glf_records_private.parties set name=trim(p_data->>'name') where id=p_id;end if;
  end if;
  update glf_records_private.parties set version=version+1 where id=p_id;result:=glf_records_private.party(p_id);
  insert into glf_records_private.directory_events(party_id,actor_id,action,before_data,after_data) values(p_id,auth.uid(),p_action,before_data,result);return result;
 end if;
 if p_action in('close','withdraw_attachment','cancel_document','replace_document','archive_bundle') then
  if not glf_records_private.readable(p_id) then raise exception 'FORBIDDEN';end if;
  select * into d from glf_records_private.documents where id=p_id for update;
  if p_action<>'archive_bundle' and d.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
  if p_action='archive_bundle' then
   result:=glf_records_private.core_v034('read',p_id,null,'{}');
   return result||jsonb_build_object('archive_files',coalesce((select jsonb_agg(to_jsonb(ff) order by ff.created_at,ff.id) from glf_records_private.files ff where ff.document_id=p_id and ff.confirmed),'[]'),'replacements',coalesce((select jsonb_agg(jsonb_build_object('id',dd.id,'subject',dd.subject,'internal_number',dd.internal_number,'status',dd.status)) from glf_records_private.documents dd where (dd.replaces_id=p_id or dd.id=d.replaces_id) and glf_records_private.readable(dd.id)),'[]'));
  end if;
  if length(reason) not between 5 and 3000 then raise exception 'REASON_REQUIRED';end if;
  if p_action='close' then
   if not glf_records_private.allowed('archive') then raise exception 'FORBIDDEN';end if;
   pending:=d.direction='incoming' and d.requires_response and not exists(select 1 from glf_records_private.documents r join glf_records_private.dispatches sd on sd.document_id=r.id and sd.status='sent' where r.parent_id=p_id and r.status<>'cancelled');
   if pending then
    if coalesce((p_data->>'response_exception')::boolean,false) is not true then raise exception 'RESPONSE_PENDING';end if;
    if not glf_records_private.allowed('assign') then raise exception 'EXCEPTION_NOT_AUTHORIZED';end if;
    result:=glf_records_private.core_v034('close',p_id,p_version,p_data);
    insert into glf_records_private.events(document_id,actor_id,action,detail) values(p_id,auth.uid(),'close_response_exception',reason);return result;
   end if;
   return glf_records_private.core_v034(p_action,p_id,p_version,p_data);
  end if;
  if p_action='withdraw_attachment' then
   if d.direction<>'outgoing' or d.status<>'draft' or d.author_id<>auth.uid() or not glf_records_private.allowed('create') then raise exception 'FORBIDDEN_OR_STATE';end if;
   select * into f from glf_records_private.files where id=(p_data->>'file_id')::uuid and document_id=p_id and kind='attachment' and confirmed and withdrawn_at is null for update;
   if not found then raise exception 'FILE_MISSING';end if;
   update glf_records_private.files set withdrawn_at=now() where id=f.id;
   insert into glf_records_private.events(document_id,actor_id,action,detail,evidence_file_id) values(p_id,auth.uid(),p_action,reason,f.id);
  else
   if d.direction<>'outgoing' or d.internal_number is null or not (public.glf_admin_allowed() or (d.signer_id=auth.uid() and glf_records_private.allowed('sign'))) then raise exception 'FORBIDDEN_OR_STATE';end if;
   if exists(select 1 from glf_records_private.dispatches where document_id=p_id and status in('pending','sending','uncertain')) then raise exception 'DISPATCH_UNRESOLVED';end if;
   if p_action='cancel_document' then
    if d.status not in('prepared','signed','sent','closed') then raise exception 'INVALID_STATE';end if;
    update glf_records_private.documents set status='cancelled' where id=p_id;
   else
    if d.status<>'cancelled' or not glf_records_private.allowed('create') then raise exception 'INVALID_STATE';end if;
    select id into v from glf_records_private.documents where replaces_id=p_id;if v is not null then if not glf_records_private.readable(v) then raise exception 'FORBIDDEN';end if;return to_jsonb(v);end if;
    result:=glf_records_private.core_v034('read',p_id,null,'{}');
    select jsonb_agg(jsonb_build_object('party_id',r.party_id,'contact_id',r.contact_id,'kind',r.kind)) into x from glf_records_private.recipients r where r.document_id=p_id;
    v:=(glf_records_private.core_v034('save',null,null,jsonb_build_object('direction','outgoing','classification',d.classification,'subject',d.subject,'body',d.body,'body_format',result->'body_format','signer_id',d.signer_id,'parent_id',d.parent_id,'recipients',x))#>>'{}')::uuid;
    update glf_records_private.documents set replaces_id=p_id where id=v;
    insert into glf_records_private.events(document_id,actor_id,action,detail) values(v,auth.uid(),'replaces_document',d.internal_number||' · '||reason);
   end if;
   insert into glf_records_private.events(document_id,actor_id,action,detail) values(p_id,auth.uid(),p_action,reason);
  end if;
  update glf_records_private.documents set version=version+1,updated_at=now() where id=p_id;
  return to_jsonb(coalesce(v,p_id));
 end if;
 result:=glf_records_private.core_v034(p_action,p_id,p_version,p_data);
 if p_action='read' then
  result:=result||jsonb_build_object('files',coalesce((select jsonb_agg(value) from jsonb_array_elements(coalesce(result->'files','[]')) where nullif(value->>'withdrawn_at','') is null),'[]'),'replacements',coalesce((select jsonb_agg(jsonb_build_object('id',dd.id,'subject',dd.subject,'internal_number',dd.internal_number,'status',dd.status)) from glf_records_private.documents dd where (dd.replaces_id=p_id or dd.id=(result->>'replaces_id')::uuid) and glf_records_private.readable(dd.id)),'[]'));
 end if;
 return result;
end;$$;
revoke all on function public.glf_records(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.glf_records(text,uuid,integer,jsonb) to authenticated;
-- Exclude withdrawn attachments from the approved snapshot while retaining their storage/history.
do $$declare definition text;begin
 select pg_get_functiondef('glf_records_private.core_v030(text,uuid,integer,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,$old$files.kind='attachment' and confirmed$old$,$new$files.kind='attachment' and confirmed and withdrawn_at is null$new$);
 execute definition;
end;$$;
commit;
