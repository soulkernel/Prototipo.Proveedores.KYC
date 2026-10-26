begin;
create or replace function glf_kyc_private.search_text(v text) returns text language sql immutable set search_path='' as $$
 select trim(regexp_replace(translate(lower(coalesce(v,'')),'áéíóúüñàèìòùâêîôûäëïöÿç','aeiouunaeiouaeiouaeioyc'),'[^a-z0-9]+',' ','g'));
$$;
create or replace function public.glf_kyc_search(p_query text default '',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q text:=glf_kyc_private.search_text(p_query); result jsonb;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if length(coalesce(p_query,''))>250 or p_offset is null or p_offset<0 then raise exception 'INVALID_SEARCH';end if;
 with source as (
  select c.id,c.code,c.supplier_id,c.name,c.email,c.relation,c.state,c.updated_at,
   glf_kyc_private.search_text(concat_ws(' ',c.name,c.answers->>'name',s.legal_name,s.trade_name)) names,
   coalesce((select jsonb_agg(d) from (select distinct typ as type,num as number,country from (values
    (c.answers->>'idType',c.answers->>'id',c.answers->>'country'),
    ('ruc',c.answers->>'taxId',c.answers->>'country'),
    (s.id_type,s.id_number,s.id_country_code),('ruc',s.tax_number,s.id_country_code)
   ) v(typ,num,country) where nullif(trim(num),'') is not null order by typ,num,country) d),'[]'::jsonb) identifications
  from public.glf_kyc_cases c left join public.glf_suppliers s on s.id=c.supplier_id
 ), matched as (
  select * from source r where q='' or
   (not exists(select 1 from unnest(string_to_array(q,' ')) word where position(word in r.names)=0)) or
   exists(select 1 from jsonb_array_elements(r.identifications) d where position(replace(q,' ','') in replace(glf_kyc_private.search_text(d->>'number'),' ',''))>0)
 ), page as (select * from matched order by updated_at desc,id desc limit 50 offset p_offset)
 select jsonb_build_object('total',(select count(*) from matched),'items',coalesce((select jsonb_agg(to_jsonb(page)-'names' order by updated_at desc,id desc) from page),'[]'::jsonb)) into result;
 return result;
end;$$;
revoke all on function glf_kyc_private.search_text(text) from public,anon,authenticated;
revoke all on function public.glf_kyc_search(text,integer) from public,anon,authenticated;
grant execute on function public.glf_kyc_search(text,integer) to authenticated;
commit;
