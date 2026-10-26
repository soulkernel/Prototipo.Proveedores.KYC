begin;
alter table public.glf_kyc_cases
 add column subject_id uuid not null default gen_random_uuid(),
 add column previous_case_id uuid references public.glf_kyc_cases(id),
 add column risk_level text check(risk_level in('high','medium','low')),
 add column final_report_id uuid references public.glf_kyc_files(id),
 add column report_issued_on date, add column report_uploaded_at timestamptz,
 add column closed_at timestamptz, add column decision_by uuid references public.glf_profiles(id),
 add column policy_due_on date, add column review_due_on date,
 add column schedule_reason text not null default '',
 add column schedule_exception boolean not null default false,
 add column review_version integer not null default 1;
-- Preserve existing cases and group earlier cycles for the same commercial record.
update public.glf_kyc_cases c set subject_id=x.subject_id from
 (select distinct on(supplier_id) supplier_id,subject_id from public.glf_kyc_cases where supplier_id is not null order by supplier_id,created_at,id) x
 where c.supplier_id=x.supplier_id;
create unique index glf_kyc_one_open_subject on public.glf_kyc_cases(subject_id) where state not in('approved','not_approved');

create function glf_kyc_private.identity_key(country text,typ text,num text,person text) returns text language sql immutable set search_path='' as $$
 select case when nullif(regexp_replace(coalesce(num,''),'[^a-zA-Z0-9]','','g'),'') is null then null else
 upper(coalesce(country,'EC'))||':'||case when country='EC' and person='natural' and typ in('ruc','cedula') then 'person:'||left(regexp_replace(num,'[^0-9]','','g'),10)
 else coalesce(typ,'')||':'||upper(regexp_replace(num,'[^a-zA-Z0-9]','','g')) end end;
$$;
create function glf_kyc_private.keys(a jsonb) returns text[] language sql immutable set search_path='' as $$
 select array_remove(array[glf_kyc_private.identity_key(a->>'country',a->>'idType',a->>'id',a->>'person'),glf_kyc_private.identity_key(a->>'country',case when a->>'country'='EC' then 'ruc' else 'tax_id' end,a->>'taxId',a->>'person')],null);
$$;
create function glf_kyc_private.related(p_supplier uuid,p_case uuid) returns setof public.glf_kyc_cases language sql stable set search_path='' as $$
 with target as(select c.subject_id,coalesce(p_supplier,c.supplier_id) supplier_id,c.answers from (values(1))v(n) left join public.glf_kyc_cases c on c.id=p_case),
 ids as(select t.*,glf_kyc_private.keys(coalesce(t.answers,'{}'))||glf_kyc_private.keys(jsonb_build_object('country',s.id_country_code,'person',s.person_type,'idType',s.id_type,'id',s.id_number,'taxId',s.tax_number)) keys from target t left join public.glf_suppliers s on s.id=t.supplier_id),
 roots as(select distinct c.subject_id from public.glf_kyc_cases c cross join ids t where c.subject_id=t.subject_id or c.supplier_id=t.supplier_id or glf_kyc_private.keys(c.answers)&&t.keys)
 select c.* from public.glf_kyc_cases c where c.subject_id in(select subject_id from roots);
$$;
create function glf_kyc_private.validity(c public.glf_kyc_cases) returns text language sql stable set search_path='' as $$
 select case when c.id is null then 'none' when c.state not in('approved','not_approved') then 'in_progress' when c.state='not_approved' then 'not_cleared' when c.review_due_on is null then 'unverified' when c.review_due_on<(now() at time zone 'Pacific/Galapagos')::date then 'expired' else 'valid' end;
$$;
create function public.glf_kyc_preflight(p_supplier uuid default null,p_case uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.glf_kyc_cases; items jsonb;s public.glf_suppliers;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if p_case is not null then select * into c from public.glf_kyc_cases where id=p_case;if not found then raise exception 'NOT_FOUND';end if;end if;
 if p_supplier is not null then select * into s from public.glf_suppliers where id=p_supplier;if not found then raise exception 'INVALID_SUPPLIER';end if;end if;
 select * into c from glf_kyc_private.related(p_supplier,p_case) order by (state not in('approved','not_approved')) desc,created_at desc,id desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'code',r.code,'state',r.state,'created_at',r.created_at,'risk_level',r.risk_level,'review_due_on',r.review_due_on,'policy_due_on',r.policy_due_on,'schedule_exception',r.schedule_exception) order by r.created_at desc,r.id desc),'[]') into items from glf_kyc_private.related(p_supplier,p_case) r;
 return jsonb_build_object('status',glf_kyc_private.validity(c),'case_id',c.id,'supplier_id',coalesce(p_supplier,c.supplier_id),'name',coalesce(c.name,s.legal_name),'email',coalesce(c.email,s.email),'relation',coalesce(c.relation,'supplier'),'review_due_on',c.review_due_on,'policy_due_on',c.policy_due_on,'schedule_exception',c.schedule_exception,'history',items);
end;$$;
create function public.glf_kyc_candidates(p_query text,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare q text:=glf_kyc_private.search_text(p_query);sup jsonb;total bigint;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if q='' or length(p_query)>250 or p_offset is null or p_offset<0 then raise exception 'INVALID_SEARCH';end if;
 with matched as(select s.id,s.legal_name,s.email,s.id_type,s.id_number,s.id_country_code,s.tax_number,s.active from public.glf_suppliers s where
 not exists(select 1 from unnest(string_to_array(q,' ')) w where position(w in glf_kyc_private.search_text(s.legal_name||' '||s.trade_name))=0)
 or position(replace(q,' ','') in replace(glf_kyc_private.search_text(s.id_number),' ',''))>0 or position(replace(q,' ','') in replace(glf_kyc_private.search_text(s.tax_number),' ',''))>0),
 page as(select * from matched order by legal_name,id limit 50 offset p_offset)
 select (select count(*) from matched),coalesce((select jsonb_agg(to_jsonb(page) order by legal_name,id) from page),'[]') into total,sup;
 return jsonb_build_object('cases',public.glf_kyc_search(p_query,p_offset),'suppliers',sup,'supplier_total',total);
end;$$;
-- Keep old RPC clients guarded; the original insert helper is no longer callable by clients.
alter function public.glf_kyc_create(uuid,text,text,text) set schema glf_kyc_private;
alter function glf_kyc_private.glf_kyc_create(uuid,text,text,text) rename to create_base;
create function public.glf_kyc_start(p_supplier uuid,p_previous uuid,p_name text,p_email text,p_relation text,p_reason text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.glf_kyc_cases; chosen public.glf_kyc_cases;v uuid;st text;sid uuid:=p_supplier;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if p_name is null or length(trim(p_name)) not between 1 and 250 or p_email is null or length(p_email)>250 or p_relation is null or p_relation not in('supplier','consultant','staff','board') or length(coalesce(p_reason,''))>1000 then raise exception 'INVALID_INPUT';end if;
 -- Serializes creation only; prevents two concurrent starts of one subject.
 perform pg_advisory_xact_lock(7401025);
 if p_previous is not null then
  select * into chosen from public.glf_kyc_cases where id=p_previous;
  if not found then raise exception 'NOT_FOUND';end if;
  if sid is not null and sid is distinct from chosen.supplier_id and not exists(select 1 from glf_kyc_private.related(sid,null) x where x.id=chosen.id) then raise exception 'INVALID_SUPPLIER';end if;
  sid:=coalesce(sid,chosen.supplier_id);
 end if;
 select * into c from glf_kyc_private.related(sid,p_previous) order by (state not in('approved','not_approved')) desc,created_at desc,id desc limit 1;
 if c.id is null and sid is null and p_previous is null then
  select * into c from public.glf_kyc_cases where lower(email)=lower(trim(p_email)) and glf_kyc_private.search_text(name)=glf_kyc_private.search_text(p_name) order by (state not in('approved','not_approved')) desc,created_at desc,id desc limit 1;
 end if;
 st:=glf_kyc_private.validity(c);
 if st='in_progress' then return jsonb_build_object('id',c.id,'continued',true);end if;
 if st in('valid','not_cleared','unverified') and length(trim(coalesce(p_reason,'')))<5 then raise exception 'REVIEW_REASON_REQUIRED';end if;
 if c.id is not null then p_relation:=c.relation;sid:=coalesce(sid,c.supplier_id);end if;
 v:=glf_kyc_private.create_base(sid,p_name,p_email,p_relation);
 if c.id is not null then
  update public.glf_kyc_cases set subject_id=c.subject_id,previous_case_id=c.id,answers=glf_kyc_private.project(c.answers||jsonb_build_object('name',trim(p_name),'email',lower(trim(p_email)),'truth','')) where id=v;
  insert into public.glf_kyc_events(case_id,action,actor_id,detail) values(v,'cycle_started',auth.uid(),jsonb_build_object('previous_case',c.code,'previous_status',st,'reason',coalesce(p_reason,''))::text);
 end if;
 return jsonb_build_object('id',v,'continued',false);
end;$$;
create function public.glf_kyc_create(p_supplier uuid,p_name text,p_email text,p_relation text) returns uuid language sql security definer set search_path='' as $$
 select (public.glf_kyc_start(p_supplier,null,p_name,p_email,p_relation,'')->>'id')::uuid;
$$;
-- Existing non-terminal review operations remain available. Final decisions require scheduling data.
alter function public.glf_kyc_review(uuid,text,text,boolean) set schema glf_kyc_private;
alter function glf_kyc_private.glf_kyc_review(uuid,text,text,boolean) rename to review_base;
create function public.glf_kyc_review(p_id uuid,p_state text,p_note text,p_confirm boolean default false) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if p_state in('approved','not_approved') then raise exception 'FINAL_REVIEW_REQUIRED';end if;
 return glf_kyc_private.review_base(p_id,p_state,p_note,p_confirm);
end;$$;
create function public.glf_kyc_finish(p_id uuid,p_state text,p_note text,p_confirm boolean,p_options jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.glf_kyc_cases;f public.glf_kyc_files;risk text:=p_options->>'risk';issued date;due date;standard date;base date;reason text:=trim(coalesce(p_options->>'reason',''));exception boolean;months integer;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 select * into c from public.glf_kyc_cases where id=p_id for update;
 if not found or c.state not in('submitted','review','correction') or p_state not in('approved','not_approved') or p_confirm is not true then raise exception 'INVALID_REVIEW';end if;
 if (p_options->>'expected')::integer is distinct from c.review_version then raise exception 'STALE_VERSION';end if;
 if risk is null or risk not in('high','medium','low') then raise exception 'RISK_REQUIRED';end if;
 select * into f from public.glf_kyc_files where id=(p_options->>'report')::uuid and case_id=c.id and slot='report' and version=c.version;
 if not found then raise exception 'REPORT_REQUIRED';end if;
 base:=(f.created_at at time zone 'Pacific/Galapagos')::date;issued:=nullif(p_options->>'issued','')::date;
 if issued is null or issued>base then raise exception 'INVALID_REPORT_DATE';end if;
 months:=case risk when 'high' then 12 when 'medium' then 24 else 36 end;
 standard:=(base+make_interval(months=>months))::date;
 due:=case when p_state='approved' then coalesce(nullif(p_options->>'due','')::date,standard) else null end;
 if due is not null and due<=base then raise exception 'INVALID_REVIEW_DATE';end if;
 if length(reason)>1000 or (due is distinct from standard and p_state='approved' and length(reason)<5) then raise exception 'SCHEDULE_REASON_REQUIRED';end if;
 exception:=coalesce(due>standard,false);
 if exception and coalesce((p_options->>'exception')::boolean,false) is not true then raise exception 'POLICY_EXCEPTION_REQUIRED';end if;
 perform glf_kyc_private.review_base(p_id,p_state,p_note,p_confirm);
 update public.glf_kyc_cases set risk_level=risk,final_report_id=f.id,report_issued_on=issued,report_uploaded_at=f.created_at,closed_at=now(),decision_by=auth.uid(),policy_due_on=case when p_state='approved' then standard else null end,review_due_on=due,schedule_reason=reason,schedule_exception=exception,review_version=review_version+1 where id=p_id;
 insert into public.glf_kyc_events(case_id,action,actor_id,detail) values(p_id,'review_schedule_set',auth.uid(),jsonb_build_object('risk',risk,'report',f.id,'issued',issued,'base_upload',f.created_at,'policy_due',case when p_state='approved' then standard else null end,'previous_due',null,'new_due',due,'reason',reason,'policy_exception',exception)::text);
 return true;
end;$$;
create function public.glf_kyc_reschedule(p_id uuid,p_due date,p_reason text,p_exception boolean,p_expected integer) returns boolean language plpgsql security definer set search_path='' as $$
declare c public.glf_kyc_cases;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 select * into c from public.glf_kyc_cases where id=p_id for update;
 if not found or c.state<>'approved' or c.policy_due_on is null or c.report_uploaded_at is null then raise exception 'INVALID_STATE';end if;
 if p_expected is distinct from c.review_version then raise exception 'STALE_VERSION';end if;
 if length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'SCHEDULE_REASON_REQUIRED';end if;
 if p_due is null or p_due<=(c.report_uploaded_at at time zone 'Pacific/Galapagos')::date then raise exception 'INVALID_REVIEW_DATE';end if;
 if p_due>c.policy_due_on and p_exception is not true then raise exception 'POLICY_EXCEPTION_REQUIRED';end if;
 if exists(select 1 from glf_kyc_private.related(c.supplier_id,c.id) r where r.created_at>c.created_at) then raise exception 'SUPERSEDED_REVIEW';end if;
 update public.glf_kyc_cases set review_due_on=p_due,schedule_reason=trim(p_reason),schedule_exception=p_due>c.policy_due_on,review_version=review_version+1,updated_at=now() where id=p_id;
 insert into public.glf_kyc_events(case_id,action,actor_id,detail) values(p_id,'review_rescheduled',auth.uid(),jsonb_build_object('previous_due',c.review_due_on,'new_due',p_due,'policy_due',c.policy_due_on,'reason',trim(p_reason),'policy_exception',p_due>c.policy_due_on)::text);
 return true;
end;$$;
revoke all on all functions in schema glf_kyc_private from public,anon,authenticated;
revoke all on function public.glf_kyc_preflight(uuid,uuid),public.glf_kyc_candidates(text,integer),public.glf_kyc_start(uuid,uuid,text,text,text,text),public.glf_kyc_create(uuid,text,text,text),public.glf_kyc_review(uuid,text,text,boolean),public.glf_kyc_finish(uuid,text,text,boolean,jsonb),public.glf_kyc_reschedule(uuid,date,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.glf_kyc_preflight(uuid,uuid),public.glf_kyc_candidates(text,integer),public.glf_kyc_start(uuid,uuid,text,text,text,text),public.glf_kyc_create(uuid,text,text,text),public.glf_kyc_review(uuid,text,text,boolean),public.glf_kyc_finish(uuid,text,text,boolean,jsonb),public.glf_kyc_reschedule(uuid,date,text,boolean,integer) to authenticated;
create or replace function public.glf_kyc_search(p_query text default '',p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare q text:=glf_kyc_private.search_text(p_query); result jsonb;
begin
 if public.glf_kyc_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if length(coalesce(p_query,''))>250 or p_offset is null or p_offset<0 then raise exception 'INVALID_SEARCH';end if;
 with source as (
  select c.id,c.code,c.supplier_id,c.name,c.email,c.relation,c.state,c.updated_at,c.risk_level,c.review_due_on,c.policy_due_on,c.schedule_exception,c.previous_case_id,glf_kyc_private.validity(c) validity,
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
commit;
