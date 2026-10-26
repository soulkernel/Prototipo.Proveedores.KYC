begin;
alter table public.glf_suppliers add column additional_phones jsonb not null default '[]';
create function public.glf_valid_phones(p_primary text,p_phones jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; phone text; digits text; seen text[]=array[regexp_replace(p_primary,'[^0-9]','','g')];
begin
 if jsonb_typeof(p_phones)<>'array' then return false;end if;
 if jsonb_array_length(p_phones)>2 then return false;end if;
 for item in select value from jsonb_array_elements(p_phones) loop
  if jsonb_typeof(item)<>'string' then return false;end if;
  phone=item#>>'{}';digits=regexp_replace(phone,'[^0-9]','','g');
  if length(phone)>50 or digits='' or phone !~ '^[+0-9(). -]+$' or digits=any(seen) then return false;end if;
  seen=array_append(seen,digits);
 end loop;return true;
end;$$;
revoke all on function public.glf_valid_phones(text,jsonb) from public,anon;
grant execute on function public.glf_valid_phones(text,jsonb) to authenticated;
alter table public.glf_suppliers add constraint glf_supplier_phones check(public.glf_valid_phones(phone,additional_phones));
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
 'additional_phones',coalesce(p_data->'additional_phones',v_old.additional_phones,'[]'::jsonb),'email',lower(trim(p_data->>'email')),'phone',trim(p_data->>'phone'),'contact_name',trim(coalesce(p_data->>'contact_name','')),'contact_role',trim(coalesce(p_data->>'contact_role','')),'legal_rep_name',case when p_data->>'person_type'='legal' then trim(coalesce(p_data->>'legal_rep_name','')) else '' end));
 if v_id is null then
  insert into public.glf_suppliers(scope,person_type,country_code,country_name,id_country_code,additional_emails,additional_phones,id_type,id_number,tax_number,legal_name,trade_name,offer_type,description,keywords,city,province,address,email,phone,contact_name,contact_role,legal_rep_name,created_by,updated_by)
  values(v_new.scope,v_new.person_type,v_new.country_code,v_new.country_name,v_new.id_country_code,v_new.additional_emails,v_new.additional_phones,v_new.id_type,v_new.id_number,v_new.tax_number,v_new.legal_name,v_new.trade_name,v_new.offer_type,v_new.description,v_new.keywords,v_new.city,v_new.province,v_new.address,v_new.email,v_new.phone,v_new.contact_name,v_new.contact_role,v_new.legal_rep_name,auth.uid(),auth.uid()) returning id into v_id;
 else
  update public.glf_suppliers set scope=v_new.scope,id_country_code=v_new.id_country_code,additional_emails=v_new.additional_emails,additional_phones=v_new.additional_phones,person_type=v_new.person_type,country_code=v_new.country_code,country_name=v_new.country_name,id_type=v_new.id_type,id_number=v_new.id_number,tax_number=v_new.tax_number,legal_name=v_new.legal_name,trade_name=v_new.trade_name,offer_type=v_new.offer_type,description=v_new.description,keywords=v_new.keywords,city=v_new.city,province=v_new.province,address=v_new.address,email=v_new.email,phone=v_new.phone,contact_name=v_new.contact_name,contact_role=v_new.contact_role,legal_rep_name=v_new.legal_rep_name,version=version+1,updated_at=now(),updated_by=auth.uid() where id=v_id;
 end if;
 delete from public.glf_supplier_specialties where supplier_id=v_id;
 insert into public.glf_supplier_specialties select v_id,x from unnest(v_specialties) x;
 select to_jsonb(s)||jsonb_build_object('specialty_ids',to_jsonb(v_specialties)) into v_after from public.glf_suppliers s where id=v_id;
 insert into public.glf_supplier_audit(supplier_id,actor_id,actor_name,action,previous,current_data) select v_id,id,display_name,case when v_old.id is null then 'created' else 'updated' end,v_before,v_after from public.glf_profiles where id=auth.uid();
 return v_id;
end;$$;



commit;
