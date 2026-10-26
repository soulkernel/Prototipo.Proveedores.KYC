begin;
create or replace function public.glf_kyc_inbox(p_query text default '',p_offset integer default 0,p_status text default 'all') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q text:=glf_kyc_private.search_text(p_query); result jsonb;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if p_status is null or p_status not in('all','draft','invited','expired_link','submitted','review','correction','approved','expired_kyc','not_approved','unverified') then raise exception 'INVALID_SEARCH';end if;
 if length(coalesce(p_query,''))>250 or p_offset is null or p_offset<0 then raise exception 'INVALID_SEARCH';end if;
 with source as (
  select c.id,c.code,c.supplier_id,c.name,c.email,c.relation,c.state,c.updated_at,c.risk_level,c.review_due_on,c.policy_due_on,c.schedule_exception,c.previous_case_id,c.receipt_at,i.expires_at invitation_expires_at,glf_kyc_private.validity(c) validity,case when c.state='approved' then case glf_kyc_private.validity(c) when 'expired' then 'expired_kyc' when 'unverified' then 'unverified' else 'approved' end when c.state='invited' and (i.expires_at is null or i.expires_at<=now() or i.revoked) then 'expired_link' else c.state end queue_state,
   glf_kyc_private.search_text(concat_ws(' ',c.name,c.answers->>'name',s.legal_name,s.trade_name)) names,
   coalesce((select jsonb_agg(d) from (select distinct typ as type,num as number,country from (values
    (c.answers->>'idType',c.answers->>'id',c.answers->>'country'),
    ('ruc',c.answers->>'taxId',c.answers->>'country'),
    (s.id_type,s.id_number,s.id_country_code),('ruc',s.tax_number,s.id_country_code)
   ) v(typ,num,country) where nullif(trim(num),'') is not null order by typ,num,country) d),'[]'::jsonb) identifications
  from public.glf_kyc_cases c left join public.glf_suppliers s on s.id=c.supplier_id left join glf_kyc_private.invitations i on i.case_id=c.id
 ), matched as (
  select * from source r where q='' or
   (not exists(select 1 from unnest(string_to_array(q,' ')) word where position(word in r.names)=0)) or
   exists(select 1 from jsonb_array_elements(r.identifications) d where position(replace(q,' ','') in replace(glf_kyc_private.search_text(d->>'number'),' ',''))>0)
 ), filtered as(select * from matched where p_status='all' or queue_state=p_status), counts as(select queue_state,count(*) n from matched group by queue_state), page as (select * from filtered order by updated_at desc,id desc limit 50 offset p_offset)
 select jsonb_build_object('total',(select count(*) from filtered),'counts',coalesce((select jsonb_object_agg(queue_state,n) from counts),'{}'::jsonb)||jsonb_build_object('all',(select count(*) from matched)),'items',coalesce((select jsonb_agg(to_jsonb(page)-'names' order by updated_at desc,id desc) from page),'[]'::jsonb)) into result;
 return result;
end;$$;

revoke all on function public.glf_kyc_inbox(text,integer,text) from public,anon;
grant execute on function public.glf_kyc_inbox(text,integer,text) to authenticated;
commit;
