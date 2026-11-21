begin;
alter table glf_records_private.contacts add column active boolean not null default true,
 add column valid_from date, add column valid_to date;
alter table glf_records_private.recipients add column snapshot jsonb;
create table glf_records_private.directory_events(
 id bigint generated always as identity primary key,
 party_id uuid not null references glf_records_private.parties(id),
 actor_id uuid not null references public.glf_profiles(id),
 action text not null, created_at timestamptz not null default now(),
 before_data jsonb not null, after_data jsonb not null
);
alter table glf_records_private.directory_events enable row level security;
revoke all on glf_records_private.directory_events from public,anon,authenticated;

-- Preserve the existing RPC and payload contracts, without client execution grants.
do $$begin
 execute replace(pg_get_functiondef('public.glf_records(text,uuid,integer,jsonb)'::regprocedure),'FUNCTION public.glf_records(','FUNCTION glf_records_private.core_v032(');
 execute replace(pg_get_functiondef('glf_records_private.payload(uuid)'::regprocedure),'FUNCTION glf_records_private.payload(','FUNCTION glf_records_private.payload_v032(');
end;$$;
revoke all on function glf_records_private.core_v032(text,uuid,integer,jsonb),glf_records_private.payload_v032(uuid) from public,anon,authenticated;

-- Bind legacy implicit contacts before an authority can be replaced.
update glf_records_private.recipients r set contact_id=(select c.id from glf_records_private.contacts c where c.party_id=r.party_id order by c.is_representative desc,c.name,c.id limit 1) where contact_id is null;
create function glf_records_private.freeze_recipient(p_party uuid,p_contact uuid,p_kind text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('kind',p_kind,'party',glf_records_private.party(p_party)-'contacts','contact_id',p_contact,'contact',(select to_jsonb(c) from glf_records_private.contacts c where c.id=p_contact));
$$;
update glf_records_private.recipients r set snapshot=glf_records_private.freeze_recipient(r.party_id,r.contact_id,r.kind)
 from glf_records_private.documents d where d.id=r.document_id and d.status not in('draft','review');
create function glf_records_private.freeze_directory_on_issue() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status='draft' then update glf_records_private.recipients set snapshot=null where document_id=new.id;
 elsif old.status in('draft','review') and new.status not in('draft','review') then
 update glf_records_private.recipients set snapshot=glf_records_private.freeze_recipient(party_id,contact_id,kind) where document_id=new.id;
 end if;return new;
end;$$;
create trigger records_freeze_directory after update of status on glf_records_private.documents for each row execute function glf_records_private.freeze_directory_on_issue();
create or replace function glf_records_private.payload(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select glf_records_private.payload_v032(p_id)||jsonb_build_object('recipients',coalesce((select jsonb_agg(coalesce(r.snapshot,jsonb_build_object('kind',r.kind,'party',glf_records_private.party(r.party_id),'contact_id',r.contact_id,'contact',(select to_jsonb(c) from glf_records_private.contacts c where c.id=r.contact_id)))) from glf_records_private.recipients r where document_id=p_id),'[]'));
$$;
revoke all on function glf_records_private.freeze_recipient(uuid,uuid,text),glf_records_private.freeze_directory_on_issue(),glf_records_private.payload(uuid) from public,anon,authenticated;

create or replace function public.glf_records(p_action text,p_id uuid default null,p_version integer default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare party_row glf_records_private.parties; contact_row glf_records_private.contacts; before_state jsonb; after_state jsonb; result jsonb; effective date; contact_id uuid; item jsonb; data jsonb:=p_data;
begin
 if public.glf_is_active() is not true or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FORBIDDEN';end if;
 if p_action='directory_read' then
  if not exists(select 1 from glf_records_private.parties where id=p_id) then raise exception 'NOT_FOUND';end if;
  return jsonb_build_object('party',glf_records_private.party(p_id),'history',coalesce((select jsonb_agg(to_jsonb(x) order by x.id desc) from (select e.id,e.action,e.created_at,e.before_data,e.after_data,p.display_name actor_name from glf_records_private.directory_events e join public.glf_profiles p on p.id=e.actor_id where e.party_id=p_id order by e.id desc limit 100) x),'[]'));
 end if;
 if p_action='parties_export' then
  return coalesce((select jsonb_agg(glf_records_private.party(x.id) order by x.name,x.id) from (select p.id,coalesce(p.name,s.legal_name) name from glf_records_private.parties p left join public.glf_suppliers s on s.id=p.supplier_id where coalesce(p.name,s.legal_name) ilike '%'||left(coalesce(data->>'q',''),200)||'%' or exists(select 1 from glf_records_private.contacts c where c.party_id=p.id and (c.name ilike '%'||left(coalesce(data->>'q',''),200)||'%' or c.email ilike '%'||left(coalesce(data->>'q',''),200)||'%'))) x),'[]');
 end if;
 if p_action in('directory_update','contact_add','contact_update','authority_change') then
  if not glf_records_private.allowed('contacts') then raise exception 'FORBIDDEN';end if;
  select * into party_row from glf_records_private.parties where id=p_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if party_row.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
  before_state:=glf_records_private.party(party_row.id);
  if p_action='directory_update' then
   if party_row.supplier_id is not null then raise exception 'EDIT_IN_SUPPLIERS';end if;
   if length(trim(coalesce(data->>'name',''))) not between 2 and 250 or length(coalesce(data->>'address',''))>1000 then raise exception 'INVALID_DIRECTORY';end if;
   update glf_records_private.parties set name=trim(data->>'name'),address=trim(coalesce(data->>'address','')) where id=party_row.id;
  else
   if length(trim(coalesce(data->>'name',''))) not between 2 and 250 or length(coalesce(data->>'job_title',''))>160 or length(coalesce(data->>'phone',''))>40 or length(coalesce(data->>'email',''))>250 or (coalesce(data->>'email','')<>'' and data->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'INVALID_CONTACT';end if;
   if p_action='contact_update' then
    contact_id:=nullif(data->>'contact_id','')::uuid;
    select * into contact_row from glf_records_private.contacts where id=contact_id and party_id=party_row.id;
    if not found then raise exception 'INVALID_CONTACT';end if;
    update glf_records_private.contacts set name=trim(data->>'name'),job_title=trim(coalesce(data->>'job_title','')),email=lower(trim(coalesce(data->>'email',''))),phone=trim(coalesce(data->>'phone','')) where id=contact_row.id;
   else
    effective:=coalesce(nullif(data->>'valid_from','')::date,(now() at time zone 'Pacific/Galapagos')::date);
    if effective>(now() at time zone 'Pacific/Galapagos')::date then raise exception 'INVALID_DATE';end if;
    if p_action='authority_change' then
     if coalesce(before_state->>'kind','institution')='natural' then raise exception 'INVALID_DIRECTORY';end if;
     if exists(select 1 from glf_records_private.contacts where party_id=party_row.id and active and is_representative and valid_from>effective) then raise exception 'INVALID_DATE';end if;
     update glf_records_private.contacts set active=false,valid_to=effective where party_id=party_row.id and active and is_representative;
    end if;
    insert into glf_records_private.contacts(party_id,name,job_title,email,phone,is_representative,valid_from) values(party_row.id,trim(data->>'name'),trim(coalesce(data->>'job_title','')),lower(trim(coalesce(data->>'email',''))),trim(coalesce(data->>'phone','')),p_action='authority_change',effective) returning id into contact_id;
   end if;
  end if;
  update glf_records_private.parties set version=version+1 where id=party_row.id;
  after_state:=glf_records_private.party(party_row.id);
  insert into glf_records_private.directory_events(party_id,actor_id,action,before_data,after_data) values(party_row.id,auth.uid(),p_action,before_state,after_state);
  return after_state;
 end if;
 if p_action='party' then
  if p_id is not null then raise exception 'USE_DIRECTORY_ACTION';end if;
  -- Keep supplier linking compatible, but do not silently create a second authority.
  if nullif(data->>'supplier_id','') is not null and coalesce((data->'contact'->>'is_representative')::boolean,false) and exists(select 1 from glf_records_private.parties p join glf_records_private.contacts c on c.party_id=p.id where p.supplier_id=(data->>'supplier_id')::uuid and c.active and c.is_representative) then raise exception 'AUTHORITY_EXISTS';end if;
  result:=glf_records_private.core_v032(p_action,p_id,p_version,data);
  insert into glf_records_private.directory_events(party_id,actor_id,action,before_data,after_data) values((result->>'id')::uuid,auth.uid(),'created','{}',result);return result;
 end if;
 if p_action='save' and jsonb_typeof(data->'recipients')='array' then
  -- A stored draft must bind a specific contact, not a moving implicit default.
  result:='[]';for item in select value from jsonb_array_elements(data->'recipients') loop
   if nullif(item->>'contact_id','') is null then
    select id into contact_id from glf_records_private.contacts where party_id=(item->>'party_id')::uuid and active order by is_representative desc,name,id limit 1;
    item:=item||jsonb_build_object('contact_id',contact_id);
   end if;result:=result||jsonb_build_array(item);
  end loop;data:=jsonb_set(data,'{recipients}',result);
 end if;
 return glf_records_private.core_v032(p_action,p_id,p_version,data);
end;$$;
revoke all on function public.glf_records(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.glf_records(text,uuid,integer,jsonb) to authenticated;
commit;
