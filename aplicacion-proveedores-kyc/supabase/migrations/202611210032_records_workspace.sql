-- Read-only workspace views. No tables, document mutations or new privileges.
begin;
create or replace function glf_records_private.core_v031(p_action text,p_id uuid default null,p_version integer default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare d glf_records_private.documents; parent glf_records_private.documents; v uuid; target uuid; evidence uuid; deadline date; result jsonb; related jsonb; timeline jsonb; reason text:=trim(coalesce(p_data->>'reason','')); recipient_data jsonb; signer uuid; intro text;
begin
 if public.glf_is_active() is not true or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FORBIDDEN';end if;
 if p_action in('directive','attention','reply','assign') then
  if not glf_records_private.readable(p_id) then raise exception 'FORBIDDEN';end if;
  select * into d from glf_records_private.documents where id=p_id for update;
  if p_action in('assign','directive') and not glf_records_private.allowed('assign') then raise exception 'FORBIDDEN';end if;
  if p_action='attention' and d.assigned_to is distinct from auth.uid() and not glf_records_private.allowed('assign') then raise exception 'FORBIDDEN';end if;
  if p_action='reply' and not glf_records_private.allowed('create') then raise exception 'FORBIDDEN';end if;
  if d.direction<>'incoming' or d.status not in('received','assigned') then raise exception 'INVALID_STATE';end if;
  if p_action='reply' then
   if not glf_records_private.allowed('create') then raise exception 'FORBIDDEN';end if;
   -- The parent lock serializes repeated clicks, including two browser sessions.
   select id into v from glf_records_private.documents where parent_id=p_id and status='draft' and glf_records_private.readable(id) order by created_at,id limit 1;
   if v is not null then return to_jsonb(v);end if;
   if d.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
   select jsonb_agg(jsonb_build_object('party_id',party_id,'contact_id',contact_id,'kind','to')) into recipient_data from glf_records_private.recipients where document_id=p_id and kind='from';
   select user_id into signer from glf_records_private.members where user_id=auth.uid() and glf_records_private.allowed('sign');
   intro:=case when p_data->>'lang'='en' then 'In response to your letter' else 'En atención al oficio' end;
   if nullif(trim(d.external_number),'') is not null then intro:=intro||case when p_data->>'lang'='en' then ' No. ' else ' N.º ' end||d.external_number;end if;
   if d.document_date is not null then intro:=intro||case when p_data->>'lang'='en' then ', dated ' else ', de fecha ' end||to_char(d.document_date,'DD/MM/YYYY');end if;
   intro:=intro||case when p_data->>'lang'='en' then ', regarding “'||d.subject||'”, please find the following information:' else ', referente a «'||d.subject||'», me permito informar lo siguiente:' end||E'\n\n';
   return glf_records_private.core_v030('save',null,null,jsonb_build_object('direction','outgoing','subject',left(case when p_data->>'lang'='en' then 'Reply to: ' else 'Respuesta a: ' end||d.subject,300),'body',intro,'classification',d.classification,'signer_id',signer,'parent_id',p_id,'recipients',coalesce(recipient_data,'[]')));
  end if;
  if d.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
  if length(reason) not between 5 and 3000 then raise exception 'REASON_REQUIRED';end if;
  if p_action in('assign','directive') then
   if not glf_records_private.allowed('assign') then raise exception 'FORBIDDEN';end if;
   target:=case when p_action='directive' then coalesce(nullif(p_data->>'assigned_to','')::uuid,d.assigned_to) else nullif(p_data->>'assigned_to','')::uuid end;
   if target is null or not exists(select 1 from public.glf_profiles where id=target and active) then raise exception 'INVALID_ASSIGNEE';end if;
   deadline:=nullif(p_data->>'due_date','')::date;
   if deadline<(d.received_at at time zone 'Pacific/Galapagos')::date then raise exception 'INVALID_DATE';end if;
   if p_action='assign' then
    result:=glf_records_private.core_v030('assign',p_id,p_version,p_data);
    update glf_records_private.events set target_id=target,due_date=deadline where id=(select max(id) from glf_records_private.events where document_id=p_id and action='assign');
    return result;
   end if;
   update glf_records_private.documents set assigned_to=target,due_date=deadline,requires_response=coalesce((p_data->>'requires_response')::boolean,d.requires_response),status='assigned' where id=p_id;
  else
   if d.assigned_to is distinct from auth.uid() and not glf_records_private.allowed('assign') then raise exception 'FORBIDDEN';end if;
   target:=d.assigned_to;deadline:=d.due_date;evidence:=nullif(p_data->>'evidence_file_id','')::uuid;
   if evidence is not null and not exists(select 1 from glf_records_private.files where id=evidence and document_id=p_id and confirmed) then raise exception 'INVALID_EVIDENCE';end if;
  end if;
  insert into glf_records_private.events(document_id,actor_id,action,detail,target_id,due_date,evidence_file_id) values(p_id,auth.uid(),p_action,reason,target,deadline,evidence);
  update glf_records_private.documents set version=version+1,updated_at=now() where id=p_id;
  return to_jsonb(p_id);
 end if;
 if p_action='save' then
  -- A linked reply cannot downgrade the confidentiality of its antecedent.
  if p_id is not null then select * into d from glf_records_private.documents where id=p_id;v:=d.parent_id;else v:=nullif(p_data->>'parent_id','')::uuid;end if;
  if v is not null then
   if not glf_records_private.readable(v) then raise exception 'FORBIDDEN';end if;
   select * into parent from glf_records_private.documents where id=v for update;
   if parent.classification='restricted' then p_data:=jsonb_set(p_data,'{classification}','"restricted"');end if;
  end if;
 end if;
 result:=glf_records_private.core_v030(p_action,p_id,p_version,p_data);
 if p_action<>'read' then return result;end if;
 select * into d from glf_records_private.documents where id=p_id;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]') into related from (
  select c.id,c.direction,c.status,c.internal_number,c.external_number,c.subject,c.document_date,c.author_id,c.created_at,(select min(sent_at) from glf_records_private.dispatches where document_id=c.id and status='sent') sent_at
  from glf_records_private.documents c where (c.parent_id=p_id or c.id=d.parent_id) and glf_records_private.readable(c.id)
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.event_id desc),'[]') into timeline from (
  select e.id event_id,e.action,e.detail,e.created_at,a.display_name actor_name,t.display_name target_name,e.due_date,e.evidence_file_id,f.filename evidence_name,null::uuid related_id
  from glf_records_private.events e join public.glf_profiles a on a.id=e.actor_id left join public.glf_profiles t on t.id=e.target_id left join glf_records_private.files f on f.id=e.evidence_file_id
  where e.document_id=p_id and e.action in('register','assign','directive','attention','close')
  union all
  select e.id,case when e.action='saved' then 'reply_created' else e.action end,e.detail,e.created_at,a.display_name,null,null,null,null,c.id
  from glf_records_private.documents c join glf_records_private.events e on e.document_id=c.id join public.glf_profiles a on a.id=e.actor_id
  where c.parent_id=p_id and glf_records_private.readable(c.id) and (e.action in('submit','approve','return','verify','manual_sent','dispatch_sent','dispatch_uncertain','dispatch_failed') or (e.action='saved' and e.id=(select min(id) from glf_records_private.events where document_id=c.id and action='saved')))
 ) x;
 return result||jsonb_build_object('related',related,'followup',timeline,'assigned_name',(select display_name from public.glf_profiles where id=d.assigned_to));
end;$$;

revoke all on function glf_records_private.core_v031(text,uuid,integer,jsonb) from public,anon,authenticated;
create or replace function public.glf_records(p_action text,p_id uuid default null,p_version integer default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare states text[]:='{}'; view_name text:=coalesce(p_data->>'view','all'); direction_name text:=coalesce(p_data->>'direction',''); result jsonb;
begin
 if public.glf_is_active() is not true or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FORBIDDEN';end if;
 if p_action<>'list' then return glf_records_private.core_v031(p_action,p_id,p_version,p_data);end if;
 if direction_name not in('','incoming','outgoing') then raise exception 'INVALID_DIRECTION';end if;
 if view_name<>'all' then
  if direction_name='incoming' and view_name='attention' then states:=array['received','assigned'];
  elsif direction_name='incoming' and view_name='closed' then states:=array['closed'];
  elsif direction_name='outgoing' and view_name='drafts' then states:=array['draft'];
  elsif direction_name='outgoing' and view_name='signature' then states:=array['review','prepared'];
  elsif direction_name='outgoing' and view_name='dispatch' then states:=array['signed'];
  elsif direction_name='outgoing' and view_name='sent' then states:=array['sent'];
  else raise exception 'INVALID_VIEW';end if;
 end if;
 if nullif(p_data->>'date_from','')::date > nullif(p_data->>'date_to','')::date then raise exception 'INVALID_DATE';end if;
 with filtered as materialized (
  select dd.* from glf_records_private.documents dd
   where glf_records_private.readable(dd.id)
    and (coalesce(p_data->>'direction','')='' or dd.direction=p_data->>'direction')
    and (cardinality(states)=0 or dd.status=any(states))
    and (coalesce(p_data->>'status','')='' or dd.status=p_data->>'status')
    and (nullif(p_data->>'person_id','') is null or case when dd.direction='incoming' then dd.assigned_to else dd.author_id end=(p_data->>'person_id')::uuid)
    and (nullif(p_data->>'signer_id','') is null or dd.signer_id=(p_data->>'signer_id')::uuid)
    and (nullif(p_data->>'date_from','') is null or case when dd.direction='incoming' then (dd.received_at at time zone 'Pacific/Galapagos')::date else dd.document_date end >= (p_data->>'date_from')::date)
    and (nullif(p_data->>'date_to','') is null or case when dd.direction='incoming' then (dd.received_at at time zone 'Pacific/Galapagos')::date else dd.document_date end <= (p_data->>'date_to')::date)
    and (coalesce(p_data->>'deadline','')='' or (dd.status not in('closed','cancelled') and dd.due_date is not null and case when p_data->>'deadline'='overdue' then dd.due_date<(now() at time zone 'Pacific/Galapagos')::date else dd.due_date>=(now() at time zone 'Pacific/Galapagos')::date end))
    and (concat_ws(' ',dd.subject,dd.external_number,dd.internal_number) ilike '%'||left(coalesce(p_data->>'q',''),200)||'%'
     or exists(select 1 from glf_records_private.recipients rr join glf_records_private.parties pp on pp.id=rr.party_id left join public.glf_suppliers s on s.id=pp.supplier_id left join glf_records_private.contacts c on c.id=rr.contact_id where rr.document_id=dd.id and concat_ws(' ',pp.name,s.legal_name,s.contact_name,s.legal_rep_name,c.name) ilike '%'||left(coalesce(p_data->>'q',''),200)||'%'))

 ), page as (
  select dd.id,dd.direction,dd.subject,dd.status,dd.classification,dd.document_date,dd.received_at,dd.internal_number,dd.external_number,dd.year,dd.sequence,dd.due_date,dd.version,dd.author_id,dd.updated_at,
   (select display_name from public.glf_profiles where id=dd.author_id) author_name,
   (select display_name from public.glf_profiles where id=dd.assigned_to) assigned_name,
   (select string_agg(coalesce(pp.name,s.legal_name),' · ') from glf_records_private.recipients rr join glf_records_private.parties pp on pp.id=rr.party_id left join public.glf_suppliers s on s.id=pp.supplier_id where rr.document_id=dd.id and rr.kind in('to','from')) correspondent
  from filtered dd order by dd.updated_at desc,dd.id limit 50 offset greatest(0,least(coalesce((p_data->>'offset')::int,0),100000))
 )
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(p) order by p.updated_at desc,p.id) from page p),'[]'),
  'total',(select count(*) from filtered),
  'draft_count',(select count(*) from glf_records_private.documents d where d.direction='outgoing' and d.status='draft' and glf_records_private.readable(d.id))) into result;
 return result;
end;$$;
revoke all on function public.glf_records(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.glf_records(text,uuid,integer,jsonb) to authenticated;
commit;
