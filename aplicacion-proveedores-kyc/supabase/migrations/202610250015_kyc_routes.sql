begin;
alter function public.glf_kyc_preflight(uuid,uuid) set schema glf_kyc_private;
alter function glf_kyc_private.glf_kyc_preflight(uuid,uuid) rename to preflight_base;
create function public.glf_kyc_preflight(p_supplier uuid default null,p_case uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb;v text;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 r=glf_kyc_private.preflight_base(p_supplier,p_case);
 select answers->>'nationalityType' into v from public.glf_kyc_cases where id=(r->>'case_id')::uuid;
 if v is null then select case when country_code='EC' then 'national' else 'international' end into v from public.glf_suppliers where id=(r->>'supplier_id')::uuid;end if;
 return r||jsonb_build_object('nationalityType',coalesce(v,'national'));
end;$$;
create function public.glf_kyc_start_route(p_supplier uuid,p_previous uuid,p_name text,p_email text,p_route text,p_reason text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;relation text:=split_part(p_route,'_',1);location text:=split_part(p_route,'_',2);
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if p_route is null or p_route not in('supplier_national','supplier_international','consultant_national','consultant_international','staff','board') or (p_supplier is not null and relation in('staff','board')) then raise exception 'INVALID_ROUTE';end if;
 r=public.glf_kyc_start(p_supplier,p_previous,p_name,p_email,relation,p_reason);
 if (r->>'continued')::boolean is false and p_previous is null and relation in('supplier','consultant') then
 update public.glf_kyc_cases set answers=glf_kyc_private.project(answers||jsonb_build_object('nationalityType',location)) where id=(r->>'id')::uuid and previous_case_id is null;
 end if;return r;
end;$$;
revoke all on all functions in schema glf_kyc_private from public,anon,authenticated;
revoke all on function public.glf_kyc_preflight(uuid,uuid),public.glf_kyc_start_route(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.glf_kyc_preflight(uuid,uuid),public.glf_kyc_start_route(uuid,uuid,text,text,text,text) to authenticated;
commit;
