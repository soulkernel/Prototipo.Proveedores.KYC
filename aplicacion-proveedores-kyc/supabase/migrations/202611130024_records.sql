-- Additive correspondence module. No identities, supplier copies or KYC answers.
begin;
create schema glf_records_private;
revoke all on schema glf_records_private from public,anon,authenticated;
create table glf_records_private.units(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 2 and 120),code text not null unique check(code ~ '^[A-Z]{2,10}$'),active boolean not null default true,version integer not null default 1);
create table glf_records_private.sites(id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 2 and 120),code text not null unique check(code ~ '^[A-Z]{2,6}$'),active boolean not null default true,version integer not null default 1);
create table glf_records_private.roles(id uuid primary key default gen_random_uuid(),name text not null unique check(length(trim(name)) between 2 and 100),version integer not null default 1);
create table glf_records_private.role_permissions(role_id uuid references glf_records_private.roles(id),permission text check(permission in('create','contacts','receive','assign','sign','dispatch','archive')),primary key(role_id,permission));
create table glf_records_private.members(user_id uuid primary key references public.glf_profiles(id),unit_id uuid not null references glf_records_private.units(id),site_id uuid not null references glf_records_private.sites(id),initials text not null check(initials ~ '^[A-Z]{2,8}$'),job_title text not null check(length(trim(job_title)) between 2 and 160),version integer not null default 1,unique(unit_id,site_id,initials));
create table glf_records_private.member_roles(user_id uuid references glf_records_private.members(user_id),role_id uuid references glf_records_private.roles(id),primary key(user_id,role_id));
-- A supplier is a reference only; institution/person data below is ONLY for non-suppliers.
create table glf_records_private.parties(id uuid primary key default gen_random_uuid(),supplier_id uuid unique references public.glf_suppliers(id),kind text check(kind in('natural','institution')),name text check(length(trim(name)) between 2 and 250),address text not null default '' check(length(address)<=1000),version integer not null default 1,
 check((supplier_id is not null and kind is null and name is null and address='') or (supplier_id is null and kind is not null and name is not null)));
create unique index records_party_name on glf_records_private.parties(lower(trim(name)),kind) where supplier_id is null;
create table glf_records_private.contacts(id uuid primary key default gen_random_uuid(),party_id uuid not null references glf_records_private.parties(id),name text not null default '' check(length(name)<=250),job_title text not null default '' check(length(job_title)<=160),is_representative boolean not null default false,email text not null default '' check(email='' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),phone text not null default '' check(length(phone)<=40));
create table glf_records_private.documents(id uuid primary key default gen_random_uuid(),direction text not null check(direction in('outgoing','incoming')),subject text not null check(length(trim(subject)) between 3 and 300),body text not null default '' check(length(body)<=60000),place text not null default '' check(length(place)<=160),document_date date not null default (now() at time zone 'Pacific/Galapagos')::date,classification text not null default 'ordinary' check(classification in('ordinary','restricted')),status text not null check(status in('draft','review','prepared','signed','sent','received','assigned','closed','cancelled')),author_id uuid not null references public.glf_profiles(id),author_profile_version integer not null default 1,signer_id uuid references public.glf_profiles(id),unit_id uuid not null references glf_records_private.units(id),site_id uuid not null references glf_records_private.sites(id),external_number text not null default '' check(length(external_number)<=160),received_at timestamptz,channel text not null default 'email' check(channel in('email','physical','portal','other')),assigned_to uuid references public.glf_profiles(id),due_date date,requires_response boolean not null default false,parent_id uuid references glf_records_private.documents(id),year integer,sequence integer,version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(year,sequence),check((year is null)=(sequence is null)),check(direction<>'incoming' or received_at is not null));
create index records_document_inbox on glf_records_private.documents(status,updated_at desc,id);
create index records_document_author on glf_records_private.documents(author_id);
create index records_document_assigned on glf_records_private.documents(assigned_to,due_date);
create index records_document_parent on glf_records_private.documents(parent_id);
create table glf_records_private.recipients(document_id uuid references glf_records_private.documents(id),party_id uuid references glf_records_private.parties(id),contact_id uuid references glf_records_private.contacts(id),kind text not null check(kind in('to','cc','from')),primary key(document_id,party_id,kind));
create table glf_records_private.access(document_id uuid references glf_records_private.documents(id),user_id uuid references public.glf_profiles(id),primary key(document_id,user_id));
create index records_access_user on glf_records_private.access(user_id,document_id);
create table glf_records_private.counters(year integer primary key,next_number integer not null check(next_number>0));
-- JSON snapshots are immutable evidence of an issued revision, not the working directory.
create table glf_records_private.revisions(id uuid primary key default gen_random_uuid(),document_id uuid not null references glf_records_private.documents(id),version integer not null,snapshot jsonb not null,created_by uuid not null references public.glf_profiles(id),created_at timestamptz not null default now(),unique(document_id,version));
create table glf_records_private.files(id uuid primary key default gen_random_uuid(),document_id uuid not null references glf_records_private.documents(id),revision_id uuid references glf_records_private.revisions(id),kind text not null check(kind in('source','signed','attachment','incoming','proof')),filename text not null check(length(filename) between 1 and 200),path text not null unique,mime text not null,size bigint not null check(size between 1 and 20971520),uploaded_by uuid not null references public.glf_profiles(id),confirmed boolean not null default false,created_at timestamptz not null default now());
create index records_files_document on glf_records_private.files(document_id,created_at);
create table glf_records_private.signature_reviews(file_id uuid primary key references glf_records_private.files(id),reviewed_by uuid not null references public.glf_profiles(id),evidence text not null check(length(trim(evidence)) between 10 and 3000),created_at timestamptz not null default now());
create table glf_records_private.dispatches(id uuid primary key default gen_random_uuid(),document_id uuid not null references glf_records_private.documents(id),signed_file_id uuid not null references glf_records_private.files(id),actor_id uuid not null references public.glf_profiles(id),method text not null check(method in('manual','gmail')),status text not null check(status in('pending','sending','sent','uncertain','failed')),recipient_email text not null,cc_email text not null default '',subject text not null,message text not null,provider_id text,proof_file_id uuid references glf_records_private.files(id),created_at timestamptz not null default now(),sent_at timestamptz);
-- The envelope below is immutable dispatch evidence, not the working contact directory.
create function glf_records_private.valid_emails(value text,optional boolean default false) returns boolean language sql immutable set search_path='' as $$
 select case when optional and coalesce(trim(value),'')='' then true else value is not null and length(value)<=7500 and value !~ E'[\r\n]' and cardinality(string_to_array(value,',')) between 1 and 30 and not exists(select 1 from unnest(string_to_array(value,',')) x where length(trim(x))>250 or trim(x) !~ '^[^[:space:]@,;<>]+@[^[:space:]@,;<>]+\.[^[:space:]@,;<>]+$') end;
$$;
create unique index records_one_dispatch on glf_records_private.dispatches(document_id) where status in('pending','sending','sent','uncertain');
create table glf_records_private.events(id bigint generated always as identity primary key,document_id uuid references glf_records_private.documents(id),actor_id uuid not null references public.glf_profiles(id),action text not null,detail text not null default '',created_at timestamptz not null default now());
create index records_events_document on glf_records_private.events(document_id,id);
insert into glf_records_private.units(name,code) values ('Dirección Ejecutiva','DE'),('Cumplimiento y Operaciones','CO'),('Financiero','FIN'),('Proyectos','PROY'),('Sostenibilidad','SOS'),('Conservación','CONS'),('Comunicación','COM');
insert into glf_records_private.sites(name,code) values('Santa Cruz','SX'),('San Cristóbal','SC');
insert into glf_records_private.roles(name) values('Redacción'),('Recepción y archivo'),('Firma'),('Despacho');
insert into glf_records_private.role_permissions select id,p from glf_records_private.roles r cross join lateral unnest(case r.name when 'Redacción' then array['create','contacts'] when 'Recepción y archivo' then array['receive','assign','archive','contacts'] when 'Firma' then array['sign'] else array['dispatch'] end) p;
-- No user grants are seeded from names, email addresses, area membership or KYC role.
create function glf_records_private.allowed(p_permission text) returns boolean language sql stable security definer set search_path='' as $$
 select public.glf_is_active() and coalesce(auth.jwt()->>'aal','')='aal2' and (public.glf_admin_allowed() or exists(select 1 from glf_records_private.member_roles m join glf_records_private.role_permissions r on r.role_id=m.role_id where m.user_id=auth.uid() and r.permission=p_permission));$$;
create function glf_records_private.readable(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.glf_is_active() and coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from glf_records_private.documents d where d.id=p_id and (d.classification='ordinary' or d.author_id=auth.uid() or d.signer_id=auth.uid() or d.assigned_to=auth.uid() or exists(select 1 from glf_records_private.access a where a.document_id=d.id and a.user_id=auth.uid())));$$;
create function glf_records_private.party(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'supplier_id',p.supplier_id,'kind',coalesce(p.kind,case when s.person_type='legal' then 'institution' else 'natural' end),'name',coalesce(p.name,s.legal_name),'address',case when p.supplier_id is null then p.address else s.address end,'version',p.version,'email',coalesce(s.email,''),'phone',coalesce(s.phone,''),'representative',coalesce(s.legal_rep_name,''),'contact_name',coalesce(s.contact_name,''),'contact_role',coalesce(s.contact_role,''),'contacts',coalesce((select jsonb_agg(to_jsonb(c) order by c.is_representative desc,c.name) from glf_records_private.contacts c where c.party_id=p.id),'[]')) from glf_records_private.parties p left join public.glf_suppliers s on s.id=p.supplier_id where p.id=p_id;$$;
create function glf_records_private.payload(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(d)||jsonb_build_object('author_name',a.display_name,'signer_name',s.display_name,'job_title',m.job_title,'origin_code',u.code||'-'||si.code||'-'||ma.initials,'recipients',coalesce((select jsonb_agg(jsonb_build_object('kind',r.kind,'party',glf_records_private.party(r.party_id),'contact_id',r.contact_id,'contact',(select to_jsonb(c) from glf_records_private.contacts c where c.id=r.contact_id))) from glf_records_private.recipients r where r.document_id=d.id),'[]')) from glf_records_private.documents d join public.glf_profiles a on a.id=d.author_id left join public.glf_profiles s on s.id=d.signer_id left join glf_records_private.members m on m.user_id=d.signer_id join glf_records_private.members ma on ma.user_id=d.author_id join glf_records_private.units u on u.id=d.unit_id join glf_records_private.sites si on si.id=d.site_id where d.id=p_id;$$;

create function public.glf_records(p_action text,p_id uuid default null,p_version integer default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare d glf_records_private.documents; m glf_records_private.members; f glf_records_private.files; v uuid; rev uuid; seq integer; yr integer; r jsonb; item jsonb; result jsonb; kind text; code text; reason text:=trim(coalesce(p_data->>'reason','')); admin boolean; action_permission text;
begin
 if public.glf_is_active() is not true or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FORBIDDEN';end if;
 admin:=public.glf_admin_allowed();
 if p_action='bootstrap' then
  return jsonb_build_object('admin',admin,'permissions',coalesce((select jsonb_agg(distinct permission) from glf_records_private.role_permissions rp join glf_records_private.member_roles mr on mr.role_id=rp.role_id where mr.user_id=auth.uid()),'[]'),'member',(select to_jsonb(x) from glf_records_private.members x where x.user_id=auth.uid()),'units',(select jsonb_agg(to_jsonb(x) order by name) from glf_records_private.units x),'sites',(select jsonb_agg(to_jsonb(x) order by name) from glf_records_private.sites x),'signers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'job_title',mm.job_title)) from public.glf_profiles p join glf_records_private.members mm on mm.user_id=p.id where p.active and (p.manage_users or exists(select 1 from glf_records_private.member_roles mr join glf_records_private.role_permissions rp on rp.role_id=mr.role_id where mr.user_id=p.id and rp.permission='sign'))),'[]'));
 end if;
 if p_action='assignees' then
  if not glf_records_private.allowed('assign') then raise exception 'FORBIDDEN';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',display_name)) from public.glf_profiles where active),'[]');
 end if;
 if p_action='admin' then
  if not admin then raise exception 'FORBIDDEN';end if;
  return jsonb_build_object('members',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('roles',coalesce((select jsonb_agg(role_id) from glf_records_private.member_roles where user_id=x.user_id),'[]'))) from glf_records_private.members x),'[]'),'users',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',display_name,'active',active)) from public.glf_profiles),'[]'),'roles',coalesce((select jsonb_agg(to_jsonb(x)||jsonb_build_object('permissions',coalesce((select jsonb_agg(permission) from glf_records_private.role_permissions where role_id=x.id),'[]'))) from glf_records_private.roles x),'[]'));
 end if;
 if p_action in('unit','site','role','member') then
  if not admin or length(reason)<5 then raise exception 'FORBIDDEN_OR_REASON';end if;
  if p_action in('unit','site') then
   code:=upper(trim(p_data->>'code'));
   if p_id is null then
    if p_action='unit' then insert into glf_records_private.units(name,code) values(trim(p_data->>'name'),code) returning id into v;else insert into glf_records_private.sites(name,code) values(trim(p_data->>'name'),code) returning id into v;end if;
   else
    -- Codes remain stable once created: deactivate and create a successor to preserve history.
    if p_action='unit' then update glf_records_private.units set name=trim(p_data->>'name'),active=coalesce((p_data->>'active')::boolean,true),version=version+1 where id=p_id and version=p_version and units.code=code returning id into v;
    else update glf_records_private.sites set name=trim(p_data->>'name'),active=coalesce((p_data->>'active')::boolean,true),version=version+1 where id=p_id and version=p_version and sites.code=code returning id into v;end if;
    if v is null then raise exception 'STALE_VERSION_OR_CODE';end if;
   end if;
  elsif p_action='role' then
   if p_id is null then insert into glf_records_private.roles(name) values(trim(p_data->>'name')) returning id into v;
   else update glf_records_private.roles set name=trim(p_data->>'name'),version=version+1 where id=p_id and version=p_version returning id into v;if v is null then raise exception 'STALE_VERSION';end if;end if;
   delete from glf_records_private.role_permissions where role_id=v;
   insert into glf_records_private.role_permissions select v,value from jsonb_array_elements_text(p_data->'permissions');
  else
   v:=(p_data->>'user_id')::uuid;
   if not exists(select 1 from public.glf_profiles where id=v and active) or not exists(select 1 from glf_records_private.units where id=(p_data->>'unit_id')::uuid and active) or not exists(select 1 from glf_records_private.sites where id=(p_data->>'site_id')::uuid and active) then raise exception 'INVALID_MEMBER';end if;
   select * into m from glf_records_private.members where user_id=v for update;
   if found and m.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
   insert into glf_records_private.members(user_id,unit_id,site_id,initials,job_title) values(v,(p_data->>'unit_id')::uuid,(p_data->>'site_id')::uuid,upper(trim(p_data->>'initials')),trim(p_data->>'job_title')) on conflict(user_id) do update set unit_id=excluded.unit_id,site_id=excluded.site_id,initials=excluded.initials,job_title=excluded.job_title,version=members.version+1;
   delete from glf_records_private.member_roles where user_id=v;
   insert into glf_records_private.member_roles select v,value::uuid from jsonb_array_elements_text(p_data->'roles');
  end if;
  insert into glf_records_private.events(actor_id,action,detail) values(auth.uid(),p_action, v::text||': '||reason);return to_jsonb(v);
 end if;
 if p_action='parties' then
  return coalesce((select jsonb_agg(glf_records_private.party(id)) from (select p.id from glf_records_private.parties p left join public.glf_suppliers s on s.id=p.supplier_id where (coalesce(p.name,s.legal_name) ilike '%'||left(coalesce(p_data->>'q',''),200)||'%' or exists(select 1 from glf_records_private.contacts c where c.party_id=p.id and (c.name ilike '%'||left(coalesce(p_data->>'q',''),200)||'%' or c.email ilike '%'||left(coalesce(p_data->>'q',''),200)||'%'))) order by coalesce(p.name,s.legal_name),p.id limit 50 offset greatest(0,least(coalesce((p_data->>'offset')::int,0),100000))) x),'[]');
 end if;
 if p_action='party' then
  if not glf_records_private.allowed('contacts') then raise exception 'FORBIDDEN';end if;
  if nullif(p_data->>'supplier_id','') is not null then
   insert into glf_records_private.parties(supplier_id) values((p_data->>'supplier_id')::uuid) on conflict(supplier_id) do update set supplier_id=excluded.supplier_id returning id into v;
  else
   if p_id is null then insert into glf_records_private.parties(kind,name,address) values(p_data->>'kind',trim(p_data->>'name'),trim(coalesce(p_data->>'address',''))) returning id into v;
   else update glf_records_private.parties set kind=p_data->>'kind',name=trim(p_data->>'name'),address=trim(coalesce(p_data->>'address','')),version=version+1 where id=p_id and version=p_version and supplier_id is null returning id into v;if v is null then raise exception 'STALE_VERSION';end if;end if;
  end if;
  if p_data ? 'contact' then
   item:=p_data->'contact';
   insert into glf_records_private.contacts(party_id,name,job_title,is_representative,email,phone) values(v,trim(coalesce(item->>'name','')),trim(coalesce(item->>'job_title','')),coalesce((item->>'is_representative')::boolean,false),lower(trim(coalesce(item->>'email',''))),trim(coalesce(item->>'phone','')));
  end if;
  insert into glf_records_private.events(actor_id,action,detail) values(auth.uid(),'party_saved',v::text);return glf_records_private.party(v);
 end if;
 if p_action='list' then
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,direction,subject,status,classification,document_date,year,sequence,external_number,due_date,version from glf_records_private.documents where glf_records_private.readable(id) and (coalesce(p_data->>'status','')='' or status=p_data->>'status') and (subject ilike '%'||left(coalesce(p_data->>'q',''),200)||'%' or external_number ilike '%'||left(coalesce(p_data->>'q',''),200)||'%') order by updated_at desc,id limit 50 offset greatest(0,least(coalesce((p_data->>'offset')::int,0),100000))) x),'[]'));
 end if;
 if p_action='save' then
  kind:=p_data->>'direction';
  if kind not in('outgoing','incoming') then raise exception 'INVALID_DIRECTION';end if;
  if not glf_records_private.allowed(case when kind='incoming' then 'receive' else 'create' end) then raise exception 'FORBIDDEN';end if;
  select * into m from glf_records_private.members where user_id=auth.uid();
  if not found or not exists(select 1 from glf_records_private.units where id=m.unit_id and active) or not exists(select 1 from glf_records_private.sites where id=m.site_id and active) then raise exception 'MEMBER_REQUIRED';end if;
  if nullif(p_data->>'parent_id','') is not null and not glf_records_private.readable((p_data->>'parent_id')::uuid) then raise exception 'FORBIDDEN';end if;
  if nullif(p_data->>'signer_id','') is not null and not exists(select 1 from public.glf_profiles p join glf_records_private.members mm on mm.user_id=p.id where p.id=(p_data->>'signer_id')::uuid and p.active and (p.manage_users or exists(select 1 from glf_records_private.member_roles mr join glf_records_private.role_permissions rp on rp.role_id=mr.role_id where mr.user_id=p.id and rp.permission='sign'))) then raise exception 'INVALID_SIGNER';end if;
  if (p_data->>'document_date')::date>(now() at time zone 'Pacific/Galapagos')::date or (kind='incoming' and ((p_data->>'received_at')::timestamptz>now() or nullif(p_data->>'received_at','') is null)) then raise exception 'INVALID_DATE';end if;
  if p_id is null then
   insert into glf_records_private.documents(direction,subject,body,place,document_date,classification,status,author_id,author_profile_version,signer_id,unit_id,site_id,external_number,received_at,channel,parent_id)
   values(kind,trim(p_data->>'subject'),coalesce(p_data->>'body',''),trim(coalesce(p_data->>'place','')),(p_data->>'document_date')::date,p_data->>'classification',case when kind='incoming' then 'received' else 'draft' end,auth.uid(),m.version,nullif(p_data->>'signer_id','')::uuid,m.unit_id,m.site_id,trim(coalesce(p_data->>'external_number','')),nullif(p_data->>'received_at','')::timestamptz,coalesce(p_data->>'channel','email'),nullif(p_data->>'parent_id','')::uuid) returning id into v;
  else
   select * into d from glf_records_private.documents where id=p_id for update;
   if not found or not glf_records_private.readable(p_id) or d.author_id<>auth.uid() or d.direction<>kind then raise exception 'FORBIDDEN';end if;
   if d.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
   if d.status<>'draft' then raise exception 'INVALID_STATE';end if;
   update glf_records_private.documents set author_profile_version=m.version,unit_id=m.unit_id,site_id=m.site_id,subject=trim(p_data->>'subject'),body=coalesce(p_data->>'body',''),place=trim(coalesce(p_data->>'place','')),document_date=(p_data->>'document_date')::date,classification=p_data->>'classification',signer_id=nullif(p_data->>'signer_id','')::uuid,version=version+1,updated_at=now() where id=p_id;v:=p_id;
   delete from glf_records_private.recipients where document_id=v;
  end if;
  if jsonb_array_length(coalesce(p_data->'recipients','[]')) not between 1 and 30 or not exists(select 1 from jsonb_array_elements(p_data->'recipients') x where x->>'kind'=case when kind='incoming' then 'from' else 'to' end) then raise exception 'RECIPIENT_REQUIRED';end if;
  for item in select value from jsonb_array_elements(p_data->'recipients') loop
   if item->>'kind' not in(case when kind='incoming' then 'from' else 'to' end,'cc') or (kind='incoming' and item->>'kind'<>'from') then raise exception 'INVALID_RECIPIENT';end if;
   if nullif(item->>'contact_id','') is not null and not exists(select 1 from glf_records_private.contacts where id=(item->>'contact_id')::uuid and party_id=(item->>'party_id')::uuid) then raise exception 'INVALID_CONTACT';end if;
   insert into glf_records_private.recipients values(v,(item->>'party_id')::uuid,nullif(item->>'contact_id','')::uuid,item->>'kind');
  end loop;
  insert into glf_records_private.events(document_id,actor_id,action) values(v,auth.uid(),'saved');return to_jsonb(v);
 end if;
 -- All document operations enforce the same read guard, including IDs guessed via URLs.
 if not glf_records_private.readable(p_id) then raise exception 'FORBIDDEN';end if;
 select * into d from glf_records_private.documents where id=p_id for update;
 if p_action='read' then
  return glf_records_private.payload(p_id)||jsonb_build_object('revisions',coalesce((select jsonb_agg(to_jsonb(x) order by version desc) from glf_records_private.revisions x where document_id=p_id),'[]'),'files',coalesce((select jsonb_agg(to_jsonb(x)) from glf_records_private.files x where document_id=p_id and confirmed),'[]'),'events',coalesce((select jsonb_agg(to_jsonb(x)) from (select e.action,e.detail,e.created_at,p.display_name actor_name from glf_records_private.events e join public.glf_profiles p on p.id=e.actor_id where document_id=p_id order by e.id desc limit 100) x),'[]'),'dispatches',coalesce((select jsonb_agg(to_jsonb(x)) from glf_records_private.dispatches x where document_id=p_id),'[]'));
 end if;
 if d.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
 if p_action='submit' then
  if d.author_id<>auth.uid() or not glf_records_private.allowed('create') or d.status<>'draft' or d.signer_id is null or length(trim(d.body))<10 then raise exception 'INVALID_STATE';end if;
  update glf_records_private.documents set status='review' where id=p_id;
 elsif p_action in('approve','return') then
  if d.signer_id is distinct from auth.uid() or not glf_records_private.allowed('sign') or d.status<>'review' then raise exception 'FORBIDDEN_OR_STATE';end if;
  if p_action='return' then
   if length(reason)<5 then raise exception 'REASON_REQUIRED';end if;update glf_records_private.documents set status='draft' where id=p_id;
  else
   if not exists(select 1 from glf_records_private.members mm join glf_records_private.units u on u.id=mm.unit_id join glf_records_private.sites s on s.id=mm.site_id where mm.user_id=d.author_id and mm.version=d.author_profile_version and mm.unit_id=d.unit_id and mm.site_id=d.site_id and u.active and s.active) then raise exception 'ORIGIN_CHANGED';end if;
   yr:=extract(year from now() at time zone 'Pacific/Galapagos');
   insert into glf_records_private.counters values(yr,2) on conflict(year) do update set next_number=counters.next_number+1 returning next_number-1 into seq;
   update glf_records_private.documents set status='prepared',year=yr,sequence=seq where id=p_id;
   insert into glf_records_private.revisions(document_id,version,snapshot,created_by) values(p_id,d.version+1,glf_records_private.payload(p_id)||jsonb_build_object('attachments',coalesce((select jsonb_agg(jsonb_build_object('id',id,'filename',filename)) from glf_records_private.files where document_id=p_id and files.kind='attachment' and confirmed),'[]')),auth.uid());
  end if;
 elsif p_action='assign' then
  if d.direction<>'incoming' or d.status not in('received','assigned') or not glf_records_private.allowed('assign') then raise exception 'FORBIDDEN_OR_STATE';end if;
  v:=(p_data->>'assigned_to')::uuid;
  if not exists(select 1 from public.glf_profiles where id=v and active) then raise exception 'INVALID_ASSIGNEE';end if;
  if nullif(p_data->>'due_date','')::date < (d.received_at at time zone 'Pacific/Galapagos')::date then raise exception 'INVALID_DATE';end if;
  update glf_records_private.documents set status='assigned',assigned_to=v,due_date=nullif(p_data->>'due_date','')::date,requires_response=coalesce((p_data->>'requires_response')::boolean,false) where id=p_id;
 elsif p_action='share' then
  if d.author_id<>auth.uid() and not glf_records_private.allowed('assign') then raise exception 'FORBIDDEN';end if;
  insert into glf_records_private.access values(p_id,(p_data->>'user_id')::uuid) on conflict do nothing;
 elsif p_action='upload' then
  kind:=p_data->>'kind';
  if (kind='signed' and not(d.signer_id=auth.uid() and glf_records_private.allowed('sign') and d.status='prepared')) or (kind in('source','attachment') and not(d.author_id=auth.uid() and d.status='draft' and glf_records_private.allowed('create'))) or (kind='incoming' and not(d.status in('received','assigned') and glf_records_private.allowed('receive'))) or (kind='proof' and not(d.status='signed' and glf_records_private.allowed('dispatch'))) or kind not in('source','signed','attachment','incoming','proof') then raise exception 'FORBIDDEN_OR_STATE';end if;
  if p_data->>'mime' not in('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document') or (kind in('signed','incoming','proof') and p_data->>'mime'<>'application/pdf') then raise exception 'INVALID_FILE';end if;
  select id into rev from glf_records_private.revisions where document_id=p_id order by version desc limit 1;
  v:=gen_random_uuid();
  insert into glf_records_private.files(id,document_id,revision_id,kind,filename,path,mime,size,uploaded_by) values(v,p_id,rev,kind,p_data->>'filename',p_id::text||'/'||v::text,p_data->>'mime',(p_data->>'size')::bigint,auth.uid()) returning to_jsonb(files.*) into result;return result;
 elsif p_action='confirm_upload' then
  select * into f from glf_records_private.files where id=(p_data->>'file_id')::uuid and document_id=p_id;
  if not found or f.uploaded_by<>auth.uid() or not exists(select 1 from storage.objects where bucket_id='glf-correspondence' and name=f.path and (metadata->>'size')::bigint=f.size) then raise exception 'FILE_MISSING';end if;
  update glf_records_private.files set confirmed=true where id=f.id;
 elsif p_action='verify' then
  if d.status<>'prepared' or d.signer_id<>auth.uid() or not glf_records_private.allowed('sign') or length(reason)<10 then raise exception 'FORBIDDEN_OR_STATE';end if;
  select * into f from glf_records_private.files where id=(p_data->>'file_id')::uuid and document_id=p_id and files.kind='signed' and confirmed;
  if not found then raise exception 'FILE_MISSING';end if;
  insert into glf_records_private.signature_reviews(file_id,reviewed_by,evidence) values(f.id,auth.uid(),reason);
  update glf_records_private.documents set status='signed' where id=p_id;
 elsif p_action='manual_sent' then
  if d.status<>'signed' or not glf_records_private.allowed('dispatch') or length(reason)<10 then raise exception 'FORBIDDEN_OR_STATE';end if;
  select f1.* into f from glf_records_private.files f1 join glf_records_private.signature_reviews sr on sr.file_id=f1.id where f1.document_id=p_id order by f1.created_at desc limit 1;
  v:=(p_data->>'proof_file_id')::uuid;
  if f.id is null or not exists(select 1 from glf_records_private.files where id=v and document_id=p_id and files.kind='proof' and confirmed) then raise exception 'FILE_MISSING';end if;
  if not glf_records_private.valid_emails(p_data->>'email') or not glf_records_private.valid_emails(p_data->>'cc',true) then raise exception 'INVALID_EMAIL';end if;
  insert into glf_records_private.dispatches(document_id,signed_file_id,actor_id,method,status,recipient_email,cc_email,subject,message,proof_file_id,sent_at) values(p_id,f.id,auth.uid(),'manual','sent',p_data->>'email',coalesce(p_data->>'cc',''),d.subject,reason,v,now());
  update glf_records_private.documents set status='sent' where id=p_id;
 elsif p_action='close' then
  if not glf_records_private.allowed('archive') or d.status not in('sent','received','assigned') or length(reason)<5 then raise exception 'FORBIDDEN_OR_STATE';end if;
  update glf_records_private.documents set status='closed' where id=p_id;
 else raise exception 'UNKNOWN_ACTION';end if;
 update glf_records_private.documents set version=version+1,updated_at=now() where id=p_id;
 insert into glf_records_private.events(document_id,actor_id,action,detail) values(p_id,auth.uid(),p_action,reason);
 return to_jsonb(p_id);
end;$$;

-- Private schema is never exposed. No direct client table writes, including admin.
do $$declare t record;begin for t in select tablename from pg_tables where schemaname='glf_records_private' loop execute format('alter table glf_records_private.%I enable row level security',t.tablename);end loop;end;$$;
revoke all on all tables in schema glf_records_private from public,anon,authenticated;
revoke all on all functions in schema glf_records_private from public,anon,authenticated;
revoke all on function public.glf_records(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.glf_records(text,uuid,integer,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('glf-correspondence','glf-correspondence',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create function public.glf_records_file_allowed(p_path text,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from glf_records_private.files f join glf_records_private.documents d on d.id=f.document_id where f.path=p_path and glf_records_private.readable(f.document_id) and case when p_write then f.uploaded_by=auth.uid() and not f.confirmed and f.created_at>now()-interval '1 hour' and ((f.kind='signed' and d.status='prepared' and d.signer_id=auth.uid() and glf_records_private.allowed('sign')) or (f.kind in('source','attachment') and d.status='draft' and d.author_id=auth.uid() and glf_records_private.allowed('create')) or (f.kind='incoming' and d.status in('received','assigned') and glf_records_private.allowed('receive')) or (f.kind='proof' and d.status='signed' and glf_records_private.allowed('dispatch'))) else f.confirmed end);$$;
revoke all on function public.glf_records_file_allowed(text,boolean) from public,anon;
grant execute on function public.glf_records_file_allowed(text,boolean) to authenticated;
create policy records_file_read on storage.objects for select to authenticated using(bucket_id='glf-correspondence' and public.glf_records_file_allowed(name,false));
create policy records_file_insert on storage.objects for insert to authenticated with check(bucket_id='glf-correspondence' and public.glf_records_file_allowed(name,true));
commit;
