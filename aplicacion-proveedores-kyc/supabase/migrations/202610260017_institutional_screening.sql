begin;
alter table public.glf_kyc_cases
 add column screening_status text not null default 'pending' check(screening_status in('pending','possible_match','clear','confirmed_finding')),
 add column screening_note text not null default '',
 add column screening_file_id uuid references public.glf_kyc_files(id),
 add column screening_answers_version integer,
 add column screening_revision integer not null default 1,
 add column screening_recorded_at timestamptz,
 add column screening_by uuid references public.glf_profiles(id);
create function public.glf_kyc_screening(p_id uuid,p_expected integer,p_answers_version integer,p_status text,p_note text,p_file uuid,p_confirm boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare c public.glf_kyc_cases;actor text;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 select * into c from public.glf_kyc_cases where id=p_id for update;
 if not found or c.receipt_at is null or c.state not in('submitted','review','correction') then raise exception 'INVALID_STATE';end if;
 if c.screening_revision is distinct from p_expected or c.version is distinct from p_answers_version then raise exception 'STALE_VERSION';end if;
 if p_status is null or p_status not in('pending','possible_match','clear','confirmed_finding') or length(trim(coalesce(p_note,''))) not between 10 and 5000 or p_confirm is not true then raise exception 'INVALID_SCREENING';end if;
 if p_status<>'pending' and p_file is null then raise exception 'SCREENING_EVIDENCE_REQUIRED';end if;
 if p_file is not null and not exists(select 1 from public.glf_kyc_files where id=p_file and case_id=c.id and version=c.version and slot in('report','other')) then raise exception 'SCREENING_EVIDENCE_REQUIRED';end if;
 select display_name into actor from public.glf_profiles where id=auth.uid();
 update public.glf_kyc_cases set screening_status=p_status,screening_note=trim(p_note),screening_file_id=p_file,screening_answers_version=version,screening_revision=screening_revision+1,screening_by=auth.uid(),screening_recorded_at=now(),review_version=review_version+1,updated_at=now() where id=c.id;
 insert into public.glf_kyc_events(case_id,action,actor_id,detail) values(c.id,'screening_recorded',auth.uid(),jsonb_build_object('previous',c.screening_status,'result',p_status,'note',trim(p_note),'evidence',p_file,'answers_version',c.version,'responsible',actor)::text);
 return true;
end;$$;
-- Completed records are preserved; new favourable decisions require a reviewed screening for the current answers.
alter function public.glf_kyc_finish(uuid,text,text,boolean,jsonb) set schema glf_kyc_private;
alter function glf_kyc_private.glf_kyc_finish(uuid,text,text,boolean,jsonb) rename to finish_base;
create function public.glf_kyc_finish(p_id uuid,p_state text,p_note text,p_confirm boolean,p_options jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare c public.glf_kyc_cases;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 perform glf_kyc_private.finish_base(p_id,p_state,p_note,p_confirm,p_options);
 select * into c from public.glf_kyc_cases where id=p_id;
 if p_state='approved' and (c.screening_status not in('clear','confirmed_finding') or c.screening_answers_version is distinct from c.version or c.screening_file_id is null) then raise exception 'SCREENING_REVIEW_REQUIRED';end if;
 return true;
end;$$;
create or replace function public.glf_kyc_inbox(p_query text default '',p_offset integer default 0,p_status text default 'all') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q text:=glf_kyc_private.search_text(p_query); result jsonb;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if p_status is null or p_status not in('all','closed','draft','invited','expired_link','submitted','review','correction','approved','expired_kyc','not_approved','unverified') then raise exception 'INVALID_SEARCH';end if;
 if length(coalesce(p_query,''))>250 or p_offset is null or p_offset<0 then raise exception 'INVALID_SEARCH';end if;
 with source as (
  select c.id,c.code,c.supplier_id,c.name,c.email,c.relation,c.state,c.updated_at,c.risk_level,c.review_due_on,c.policy_due_on,c.schedule_exception,c.previous_case_id,c.receipt_at,c.closed_at,c.created_at,c.answers->>'nationalityType' nationality_type,c.answers->>'person' person_type,c.screening_status,c.screening_answers_version,c.version answers_version,c.screening_recorded_at,(select display_name from public.glf_profiles where id=c.screening_by) screening_by_name,(select max(created_at) from public.glf_kyc_events where case_id=c.id and action='invitation_issued') invitation_issued_at,i.expires_at invitation_expires_at,glf_kyc_private.validity(c) validity,case when c.state='approved' then case glf_kyc_private.validity(c) when 'expired' then 'expired_kyc' when 'unverified' then 'unverified' else 'approved' end when c.state='invited' and (i.expires_at is null or i.expires_at<=now() or i.revoked) then 'expired_link' else c.state end queue_state,
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
 ), filtered as(select * from matched where p_status='all' or (p_status='closed' and state in('approved','not_approved')) or queue_state=p_status), counts as(select queue_state,count(*) n from matched group by queue_state), page as (select * from filtered order by updated_at desc,id desc limit 50 offset p_offset)
 select jsonb_build_object('total',(select count(*) from filtered),'counts',coalesce((select jsonb_object_agg(queue_state,n) from counts),'{}'::jsonb)||jsonb_build_object('all',(select count(*) from matched),'closed',(select count(*) from matched where state in('approved','not_approved'))),'items',coalesce((select jsonb_agg(to_jsonb(page)-'names' order by updated_at desc,id desc) from page),'[]'::jsonb)) into result;
 return result;
end;$$;

revoke all on function public.glf_kyc_inbox(text,integer,text) from public,anon;
grant execute on function public.glf_kyc_inbox(text,integer,text) to authenticated;

create or replace function public.glf_kyc_read(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=glf_kyc_private.token_case(p_token);c public.glf_kyc_cases;
begin
 if cid is null then raise exception 'LINK_INVALID';end if;select * into c from public.glf_kyc_cases where id=cid;
 return jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'relation',c.relation,'answers',c.answers,'version',c.version,'pdf_version',c.pdf_version,'form_version',c.form_version,'allow_scan',c.allow_scan,'note',c.note,'expires_at',(select expires_at from glf_kyc_private.invitations where case_id=cid),'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'slot',f.slot,'name',f.name,'bytes',f.bytes,'version',f.version)) from public.glf_kyc_files f where f.case_id=cid and f.version=c.version and f.slot in(select unnest(glf_kyc_private.documents(c.answers)))),'[]'::jsonb));
end;$$;
revoke all on all functions in schema glf_kyc_private from public,anon,authenticated;
revoke all on function public.glf_kyc_screening(uuid,integer,integer,text,text,uuid,boolean),public.glf_kyc_finish(uuid,text,text,boolean,jsonb) from public,anon;
grant execute on function public.glf_kyc_screening(uuid,integer,integer,text,text,uuid,boolean),public.glf_kyc_finish(uuid,text,text,boolean,jsonb) to authenticated;
commit;
