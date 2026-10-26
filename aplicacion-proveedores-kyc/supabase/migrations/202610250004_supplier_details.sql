-- Shared commercial supplier records, identification and optional commercial emails.
begin;
alter table public.glf_suppliers add column id_country_code text;
update public.glf_suppliers set id_country_code=country_code;
alter table public.glf_suppliers alter column id_country_code set not null;
alter table public.glf_suppliers add constraint glf_supplier_issuer_country check(id_country_code ~ '^[A-Z]{2}$');
alter table public.glf_suppliers add column additional_emails jsonb not null default '[]';
-- Replace only the previous scope/identity rules; all data and audit rows are retained.
do $$ declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.glf_suppliers'::regclass and
 ((contype='c' and (pg_get_constraintdef(oid) like '%id_type%' or pg_get_constraintdef(oid) like '%scope%' or (pg_get_constraintdef(oid) like '%country_code%' and pg_get_constraintdef(oid) like '%tax_number%')))
 or (contype='u' and pg_get_constraintdef(oid) like '%country_code%')) loop
 execute format('alter table public.glf_suppliers drop constraint %I',c.conname);end loop;
end;$$;
alter table public.glf_suppliers add constraint glf_supplier_scope check(scope in('government','glf','shared'));
alter table public.glf_suppliers add constraint glf_supplier_identity_type check(
 (id_country_code='EC' and ((person_type='natural' and ((id_type='cedula' and id_number ~ '^[0-9]{10}$') or(id_type='ruc' and id_number ~ '^[0-9]{13}$'))) or(person_type='legal' and id_type='ruc' and id_number ~ '^[0-9]{13}$')))
 or(id_country_code<>'EC' and ((person_type='natural' and id_type in('passport','foreign_id')) or(person_type='legal' and id_type in('tax_id','business_registry')))));
alter table public.glf_suppliers add constraint glf_supplier_tax_format check(id_country_code<>'EC' or tax_number='' or tax_number ~ '^[0-9]{13}$');
alter table public.glf_suppliers add constraint glf_supplier_unique_document unique(id_country_code,id_type,normalized_id);
alter table public.glf_suppliers add constraint glf_supplier_unique_tax unique(id_country_code,normalized_tax);
alter table public.glf_suppliers add column normalized_person_id text generated always as(case when person_type='natural' and id_country_code='EC' and id_type in('cedula','ruc') then left(id_number,10) end) stored;
alter table public.glf_suppliers add constraint glf_supplier_unique_person unique(id_country_code,normalized_person_id);
create function public.glf_valid_emails(p_main text,p_emails jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; seen text[]=array[lower(p_main)]; address text;begin
 if jsonb_typeof(p_emails)<>'array' then return false;end if;
 if jsonb_array_length(p_emails)>10 then return false;end if;
 for item in select * from jsonb_array_elements(p_emails) loop
  address=lower(trim(coalesce(item->>'email','')));
  if jsonb_typeof(item)<>'object' or coalesce(item->>'label','') not in('sales','billing','contactEmail','other') or length(address)>250 or address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or address=any(seen) then return false;end if;
  seen=array_append(seen,address);
 end loop;return true;
end;$$;
alter table public.glf_suppliers add constraint glf_supplier_emails check(public.glf_valid_emails(email,additional_emails));
create or replace function public.glf_can(p_action text,p_scope text) returns boolean language sql stable security definer set search_path='' as $$
 select public.glf_is_active() and coalesce((select case when p_scope='shared' then
 (case p_action when 'create' then p.supplier_create_scopes when 'edit' then p.supplier_edit_scopes when 'archive' then p.supplier_archive_scopes else '{}'::text[] end) && array['government','glf']
 else p_scope=any(case p_action when 'create' then p.supplier_create_scopes when 'edit' then p.supplier_edit_scopes when 'archive' then p.supplier_archive_scopes else '{}'::text[] end) end
 from public.glf_profiles p where p.id=auth.uid()),false);
$$;
create or replace function public.glf_save_supplier(p_data jsonb,p_expected_version integer default null) returns uuid language plpgsql security definer set search_path='' as $$
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
  if not public.glf_can('edit',v_old.scope) or (v_scope<>v_old.scope and v_scope<>'shared' and not (public.glf_can('edit','government') and public.glf_can('edit','glf'))) then raise exception 'FORBIDDEN';end if;
  if p_expected_version is distinct from v_old.version then raise exception 'STALE_VERSION';end if;
  select to_jsonb(v_old)||jsonb_build_object('specialty_ids',coalesce(jsonb_agg(specialty_id),'[]'::jsonb)) into v_before from public.glf_supplier_specialties where supplier_id=v_id;
 end if;
 -- Only named directory fields are accepted; status, authorship, counters and versions are never supplied by the client.
 v_new= jsonb_populate_record(null::public.glf_suppliers,jsonb_build_object(
 'scope',v_scope,'person_type',p_data->>'person_type','country_code',upper(trim(p_data->>'country_code')),'country_name',trim(p_data->>'country_name'),
 'id_country_code',upper(coalesce(nullif(p_data->>'id_country_code',''),p_data->>'country_code')),'additional_emails',coalesce(p_data->'additional_emails','[]'::jsonb),'id_type',p_data->>'id_type','id_number',upper(regexp_replace(p_data->>'id_number','[^a-zA-Z0-9]','','g')),'tax_number',case when p_data->>'person_type'='natural' then upper(regexp_replace(coalesce(p_data->>'tax_number',''),'[^a-zA-Z0-9]','','g')) else '' end,
 'legal_name',trim(p_data->>'legal_name'),'trade_name',trim(coalesce(p_data->>'trade_name','')),'offer_type',p_data->>'offer_type',
 'description',trim(coalesce(p_data->>'description','')),'keywords',trim(coalesce(p_data->>'keywords','')),'city',trim(p_data->>'city'),'province',trim(coalesce(p_data->>'province','')),'address',trim(coalesce(p_data->>'address','')),
 'email',lower(trim(p_data->>'email')),'phone',trim(p_data->>'phone'),'contact_name',trim(coalesce(p_data->>'contact_name','')),'contact_role',trim(coalesce(p_data->>'contact_role','')),'legal_rep_name',case when p_data->>'person_type'='legal' then trim(coalesce(p_data->>'legal_rep_name','')) else '' end));
 if v_id is null then
  insert into public.glf_suppliers(scope,person_type,country_code,country_name,id_country_code,additional_emails,id_type,id_number,tax_number,legal_name,trade_name,offer_type,description,keywords,city,province,address,email,phone,contact_name,contact_role,legal_rep_name,created_by,updated_by)
  values(v_new.scope,v_new.person_type,v_new.country_code,v_new.country_name,v_new.id_country_code,v_new.additional_emails,v_new.id_type,v_new.id_number,v_new.tax_number,v_new.legal_name,v_new.trade_name,v_new.offer_type,v_new.description,v_new.keywords,v_new.city,v_new.province,v_new.address,v_new.email,v_new.phone,v_new.contact_name,v_new.contact_role,v_new.legal_rep_name,auth.uid(),auth.uid()) returning id into v_id;
 else
  update public.glf_suppliers set scope=v_new.scope,id_country_code=v_new.id_country_code,additional_emails=v_new.additional_emails,person_type=v_new.person_type,country_code=v_new.country_code,country_name=v_new.country_name,id_type=v_new.id_type,id_number=v_new.id_number,tax_number=v_new.tax_number,legal_name=v_new.legal_name,trade_name=v_new.trade_name,offer_type=v_new.offer_type,description=v_new.description,keywords=v_new.keywords,city=v_new.city,province=v_new.province,address=v_new.address,email=v_new.email,phone=v_new.phone,contact_name=v_new.contact_name,contact_role=v_new.contact_role,legal_rep_name=v_new.legal_rep_name,version=version+1,updated_at=now(),updated_by=auth.uid() where id=v_id;
 end if;
 delete from public.glf_supplier_specialties where supplier_id=v_id;
 insert into public.glf_supplier_specialties select v_id,x from unnest(v_specialties) x;
 select to_jsonb(s)||jsonb_build_object('specialty_ids',to_jsonb(v_specialties)) into v_after from public.glf_suppliers s where id=v_id;
 insert into public.glf_supplier_audit(supplier_id,actor_id,actor_name,action,previous,current_data) select v_id,id,display_name,case when v_old.id is null then 'created' else 'updated' end,v_before,v_after from public.glf_profiles where id=auth.uid();
 return v_id;
end;$$;


create function public.glf_find_supplier_duplicates(p_data jsonb) returns uuid[] language plpgsql stable security definer set search_path='' as $$
declare issuer text=upper(coalesce(nullif(p_data->>'id_country_code',''),p_data->>'country_code')); doc text=upper(regexp_replace(coalesce(p_data->>'id_number',''),'[^a-zA-Z0-9]','','g')); tax text; person_id text; result uuid[];
begin
 if not public.glf_is_active() then raise exception 'FORBIDDEN';end if;
 tax=case when p_data->>'id_type' in('ruc','tax_id') then doc else upper(regexp_replace(coalesce(p_data->>'tax_number',''),'[^a-zA-Z0-9]','','g')) end;
 person_id=case when issuer='EC' and p_data->>'person_type'='natural' and p_data->>'id_type' in('cedula','ruc') and length(doc)>=10 then left(doc,10) end;
 select coalesce(array_agg(s.id),'{}'::uuid[]) into result from public.glf_suppliers s where
 s.id is distinct from nullif(p_data->>'id','')::uuid and s.id_country_code=issuer and
 ((doc<>'' and s.id_type=p_data->>'id_type' and s.normalized_id=doc) or(tax<>'' and s.normalized_tax=tax) or(person_id is not null and s.normalized_person_id=person_id));
 return result;
end;$$;
revoke all on function public.glf_valid_emails(text,jsonb),public.glf_find_supplier_duplicates(jsonb) from public,anon;
grant execute on function public.glf_valid_emails(text,jsonb),public.glf_find_supplier_duplicates(jsonb) to authenticated;
commit;
