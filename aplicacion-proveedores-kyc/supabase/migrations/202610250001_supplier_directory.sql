-- GLF directory, phase 1. No confidential KYC answers or bank details here.
begin;
create table public.glf_profiles (
 id uuid primary key references auth.users(id), display_name text not null,
 active boolean not null default true,
 supplier_create_scopes text[] not null default '{}',
 supplier_edit_scopes text[] not null default '{}',
 supplier_archive_scopes text[] not null default '{}',
 manage_specialties boolean not null default false,
 check(supplier_create_scopes <@ array['government','glf']),
 check(supplier_edit_scopes <@ array['government','glf']),
 check(supplier_archive_scopes <@ array['government','glf'])
);
create function public.glf_is_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.glf_profiles p where p.id=auth.uid() and p.active);
$$;
create function public.glf_can(p_action text,p_scope text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select p.active and p_scope=any(case p_action when 'create' then p.supplier_create_scopes when 'edit' then p.supplier_edit_scopes when 'archive' then p.supplier_archive_scopes else '{}'::text[] end) from public.glf_profiles p where p.id=auth.uid()),false);
$$;
create function public.glf_label(p_text text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(translate(lower(p_text),'áéíóúüñ','aeiouun'),'[^a-z0-9]+',' ','g'));
$$;
create table public.glf_specialties (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 100),
 normalized_name text generated always as(public.glf_label(name)) stored unique,
 view_count integer not null default 0, created_at timestamptz not null default now(),created_by uuid references public.glf_profiles(id)
);
create table public.glf_suppliers (
 id uuid primary key default gen_random_uuid(), code bigint generated always as identity unique,
 scope text not null check(scope in('government','glf')),
 person_type text not null check(person_type in('natural','legal')),
 country_code text not null check(country_code ~ '^[A-Z]{2}$'),country_name text not null check(length(trim(country_name)) between 1 and 250),
 id_type text not null check(id_type in('cedula','ruc','foreign_id','tax_id')),id_number text not null check(length(id_number) between 1 and 250),
 tax_number text not null default '' check(length(tax_number)<=250),
 normalized_id text generated always as(upper(regexp_replace(id_number,'[^a-zA-Z0-9]','','g'))) stored,
 normalized_tax text generated always as(nullif(upper(regexp_replace(case when id_type in('ruc','tax_id') then id_number else tax_number end,'[^a-zA-Z0-9]','','g')),'')) stored,
 legal_name text not null check(length(trim(legal_name)) between 1 and 250),trade_name text not null default '' check(length(trade_name)<=250),
 offer_type text not null check(offer_type in('goods','services','both')),description text not null default '' check(length(description)<=2000),keywords text not null default '' check(length(keywords)<=2000),
 city text not null check(length(trim(city)) between 1 and 250),province text not null default '' check(length(province)<=250),address text not null default '' check(length(address)<=250),
 email text not null check(email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(email)<=250),phone text not null check(length(trim(phone)) between 1 and 250),
 contact_name text not null default '' check(length(contact_name)<=250),contact_role text not null default '' check(length(contact_role)<=250),legal_rep_name text not null default '' check(length(legal_rep_name)<=250),
 active boolean not null default true,version integer not null default 1,
 view_count integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid not null references public.glf_profiles(id),updated_by uuid not null references public.glf_profiles(id),
 unique(country_code,id_type,normalized_id),unique(country_code,normalized_tax),
 check(length(normalized_id)>0),
 check((country_code='EC' and ((person_type='natural' and id_type='cedula' and id_number ~ '^[0-9]{10}$') or (person_type='legal' and id_type='ruc' and id_number ~ '^[0-9]{13}$'))) or (country_code<>'EC' and ((person_type='natural' and id_type='foreign_id') or(person_type='legal' and id_type='tax_id')))),
 check(country_code<>'EC' or tax_number='' or tax_number ~ '^[0-9]{13}$')
);
create table public.glf_supplier_specialties(supplier_id uuid not null references public.glf_suppliers(id),specialty_id uuid not null references public.glf_specialties(id),primary key(supplier_id,specialty_id));
create table public.glf_supplier_audit(id bigint generated always as identity primary key,supplier_id uuid not null references public.glf_suppliers(id),actor_id uuid not null references public.glf_profiles(id),actor_name text not null,action text not null,reason text,previous jsonb,current_data jsonb,created_at timestamptz not null default now());
create table public.glf_supplier_views(supplier_id uuid references public.glf_suppliers(id),user_id uuid references public.glf_profiles(id),view_day date not null,primary key(supplier_id,user_id,view_day));
create table public.glf_specialty_views(specialty_id uuid references public.glf_specialties(id),user_id uuid references public.glf_profiles(id),view_day date not null,primary key(specialty_id,user_id,view_day));

alter table public.glf_profiles enable row level security;
alter table public.glf_specialties enable row level security;
alter table public.glf_suppliers enable row level security;
alter table public.glf_supplier_specialties enable row level security;
alter table public.glf_supplier_audit enable row level security;
alter table public.glf_supplier_views enable row level security;
alter table public.glf_specialty_views enable row level security;
create policy profile_self on public.glf_profiles for select to authenticated using(id=auth.uid());
create policy specialties_read on public.glf_specialties for select to authenticated using(public.glf_is_active());
create policy suppliers_read on public.glf_suppliers for select to authenticated using(public.glf_is_active());
create policy supplier_specialties_read on public.glf_supplier_specialties for select to authenticated using(public.glf_is_active());
create policy supplier_audit_read on public.glf_supplier_audit for select to authenticated using(public.glf_is_active());
-- No client INSERT/UPDATE/DELETE policies. Writes use checked, atomic functions below.
revoke all on public.glf_profiles,public.glf_specialties,public.glf_suppliers,public.glf_supplier_specialties,public.glf_supplier_audit,public.glf_supplier_views,public.glf_specialty_views from anon,authenticated;
grant usage on schema public to authenticated;
grant select on public.glf_profiles,public.glf_specialties,public.glf_suppliers,public.glf_supplier_specialties,public.glf_supplier_audit to authenticated;

create function public.glf_add_specialty(p_name text) returns public.glf_specialties language plpgsql security definer set search_path='' as $$
declare v public.glf_specialties;
begin
 if not exists(select 1 from public.glf_profiles where id=auth.uid() and active and manage_specialties) then raise exception 'FORBIDDEN';end if;
 if public.glf_label(p_name)='' then raise exception 'INVALID_SPECIALTY';end if;
 insert into public.glf_specialties(name,created_by) values(trim(p_name),auth.uid()) on conflict(normalized_name) do nothing;
 select * into v from public.glf_specialties where normalized_name=public.glf_label(p_name);return v;
end;$$;

create function public.glf_save_supplier(p_data jsonb,p_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_old public.glf_suppliers;v_new public.glf_suppliers;v_scope text;v_specialties uuid[];v_before jsonb;v_after jsonb;
begin
 if not public.glf_is_active() then raise exception 'FORBIDDEN';end if;
 v_id=nullif(p_data->>'id','')::uuid;v_scope=p_data->>'scope';
 v_specialties=array(select distinct jsonb_array_elements_text(coalesce(p_data->'specialty_ids','[]'::jsonb))::uuid);
 if coalesce(array_length(v_specialties,1),0)=0 or exists(select 1 from unnest(v_specialties) x where not exists(select 1 from public.glf_specialties where id=x)) then raise exception 'INVALID_SPECIALTIES';end if;
 if v_id is null then
  if not public.glf_can('create',v_scope) then raise exception 'FORBIDDEN';end if;
 else
  select * into v_old from public.glf_suppliers where id=v_id for update;
  if not found then raise exception 'NOT_FOUND';end if;
  if v_scope<>v_old.scope or not public.glf_can('edit',v_old.scope) then raise exception 'FORBIDDEN';end if;
  if p_expected_version is distinct from v_old.version then raise exception 'STALE_VERSION';end if;
  select to_jsonb(v_old)||jsonb_build_object('specialty_ids',coalesce(jsonb_agg(specialty_id),'[]'::jsonb)) into v_before from public.glf_supplier_specialties where supplier_id=v_id;
 end if;
 -- Only named directory fields are accepted; status, authorship, counters and versions are never supplied by the client.
 v_new= jsonb_populate_record(null::public.glf_suppliers,jsonb_build_object(
 'scope',v_scope,'person_type',p_data->>'person_type','country_code',upper(trim(p_data->>'country_code')),'country_name',trim(p_data->>'country_name'),
 'id_type',p_data->>'id_type','id_number',upper(regexp_replace(p_data->>'id_number','[^a-zA-Z0-9]','','g')),'tax_number',case when p_data->>'person_type'='natural' then upper(regexp_replace(coalesce(p_data->>'tax_number',''),'[^a-zA-Z0-9]','','g')) else '' end,
 'legal_name',trim(p_data->>'legal_name'),'trade_name',trim(coalesce(p_data->>'trade_name','')),'offer_type',p_data->>'offer_type',
 'description',trim(coalesce(p_data->>'description','')),'keywords',trim(coalesce(p_data->>'keywords','')),'city',trim(p_data->>'city'),'province',trim(coalesce(p_data->>'province','')),'address',trim(coalesce(p_data->>'address','')),
 'email',lower(trim(p_data->>'email')),'phone',trim(p_data->>'phone'),'contact_name',trim(coalesce(p_data->>'contact_name','')),'contact_role',trim(coalesce(p_data->>'contact_role','')),'legal_rep_name',case when p_data->>'person_type'='legal' then trim(coalesce(p_data->>'legal_rep_name','')) else '' end));
 if v_id is null then
  insert into public.glf_suppliers(scope,person_type,country_code,country_name,id_type,id_number,tax_number,legal_name,trade_name,offer_type,description,keywords,city,province,address,email,phone,contact_name,contact_role,legal_rep_name,created_by,updated_by)
  values(v_new.scope,v_new.person_type,v_new.country_code,v_new.country_name,v_new.id_type,v_new.id_number,v_new.tax_number,v_new.legal_name,v_new.trade_name,v_new.offer_type,v_new.description,v_new.keywords,v_new.city,v_new.province,v_new.address,v_new.email,v_new.phone,v_new.contact_name,v_new.contact_role,v_new.legal_rep_name,auth.uid(),auth.uid()) returning id into v_id;
 else
  update public.glf_suppliers set person_type=v_new.person_type,country_code=v_new.country_code,country_name=v_new.country_name,id_type=v_new.id_type,id_number=v_new.id_number,tax_number=v_new.tax_number,legal_name=v_new.legal_name,trade_name=v_new.trade_name,offer_type=v_new.offer_type,description=v_new.description,keywords=v_new.keywords,city=v_new.city,province=v_new.province,address=v_new.address,email=v_new.email,phone=v_new.phone,contact_name=v_new.contact_name,contact_role=v_new.contact_role,legal_rep_name=v_new.legal_rep_name,version=version+1,updated_at=now(),updated_by=auth.uid() where id=v_id;
 end if;
 delete from public.glf_supplier_specialties where supplier_id=v_id;
 insert into public.glf_supplier_specialties select v_id,x from unnest(v_specialties) x;
 select to_jsonb(s)||jsonb_build_object('specialty_ids',to_jsonb(v_specialties)) into v_after from public.glf_suppliers s where id=v_id;
 insert into public.glf_supplier_audit(supplier_id,actor_id,actor_name,action,previous,current_data) select v_id,id,display_name,case when v_old.id is null then 'created' else 'updated' end,v_before,v_after from public.glf_profiles where id=auth.uid();
 return v_id;
end;$$;

create function public.glf_set_supplier_active(p_id uuid,p_expected_version integer,p_active boolean,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare v public.glf_suppliers;v_after jsonb;
begin
 select * into v from public.glf_suppliers where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if not public.glf_can('archive',v.scope) then raise exception 'FORBIDDEN';end if;
 if p_expected_version is distinct from v.version then raise exception 'STALE_VERSION';end if;
 if p_active is null or length(trim(coalesce(p_reason,'')))<3 or length(p_reason)>1000 then raise exception 'REASON_REQUIRED';end if;
 update public.glf_suppliers set active=p_active,version=version+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning to_jsonb(glf_suppliers.*) into v_after;
 insert into public.glf_supplier_audit(supplier_id,actor_id,actor_name,action,reason,previous,current_data) select p_id,id,display_name,case when p_active then 'reactivated' else 'deactivated' end,trim(p_reason),to_jsonb(v),v_after from public.glf_profiles where id=auth.uid();
end;$$;
create function public.glf_record_view(p_supplier_id uuid default null,p_specialty_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.glf_is_active() then raise exception 'FORBIDDEN';end if;
 if p_supplier_id is not null then
  insert into public.glf_supplier_views values(p_supplier_id,auth.uid(),(now() at time zone 'Pacific/Galapagos')::date) on conflict do nothing;
  if found then update public.glf_suppliers set view_count=view_count+1 where id=p_supplier_id;end if;
 end if;
 if p_specialty_id is not null then
  insert into public.glf_specialty_views values(p_specialty_id,auth.uid(),(now() at time zone 'Pacific/Galapagos')::date) on conflict do nothing;
  if found then update public.glf_specialties set view_count=view_count+1 where id=p_specialty_id;end if;
 end if;
end;$$;
revoke all on function public.glf_is_active(),public.glf_can(text,text),public.glf_label(text),public.glf_add_specialty(text),public.glf_save_supplier(jsonb,integer),public.glf_set_supplier_active(uuid,integer,boolean,text),public.glf_record_view(uuid,uuid) from public,anon;
grant execute on function public.glf_is_active(),public.glf_can(text,text),public.glf_label(text),public.glf_add_specialty(text),public.glf_save_supplier(jsonb,integer),public.glf_set_supplier_active(uuid,integer,boolean,text),public.glf_record_view(uuid,uuid) to authenticated;
commit;
