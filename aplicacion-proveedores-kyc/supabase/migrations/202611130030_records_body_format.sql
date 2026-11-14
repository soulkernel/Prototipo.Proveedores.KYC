-- Server-assigned outgoing dates; existing issued documents and incoming origin dates stay unchanged.
begin;
-- Limited paragraph formatting; plain text remains the source of search and validation.
create or replace function glf_records_private.valid_body_format(body text,fmt jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare p jsonb; r jsonb; idx integer:=1; max_end integer; previous_end integer; parts text[]:=string_to_array(coalesce(body,''),E'\n');
begin
 if fmt is null or fmt='null'::jsonb then return true;end if;
 if jsonb_typeof(fmt)<>'object' or fmt->>'version' is distinct from '1' or (fmt-'version'-'paragraphs')<>'{}'::jsonb or jsonb_typeof(fmt->'paragraphs') is distinct from 'array' then return false;end if;
 if octet_length(fmt::text)>1000000 or jsonb_array_length(fmt->'paragraphs')>coalesce(array_length(parts,1),1) then return false;end if;
 for p in select value from jsonb_array_elements(fmt->'paragraphs') loop
  if jsonb_typeof(p)<>'object' or (p-'align'-'bold')<>'{}'::jsonb or coalesce(p->>'align','') not in('left','center','justify') or jsonb_typeof(p->'bold') is distinct from 'array' then return false;end if;
  max_end:=length(coalesce(parts[idx],''));previous_end:=0;
  for r in select value from jsonb_array_elements(p->'bold') loop
   if jsonb_typeof(r)<>'array' or jsonb_array_length(r)<>2 then return false;end if;
   if coalesce(r->>0,'')!~'^[0-9]{1,6}$' or coalesce(r->>1,'')!~'^[0-9]{1,6}$' then return false;end if;
   if (r->>0)::integer<previous_end or (r->>1)::integer<=(r->>0)::integer or (r->>1)::integer>max_end then return false;end if;
   previous_end:=(r->>1)::integer;
  end loop;idx:=idx+1;
 end loop;return true;
exception when others then return false;
end;$$;
revoke all on function glf_records_private.valid_body_format(text,jsonb) from public,anon,authenticated;
alter table glf_records_private.documents add column body_format jsonb;
alter table glf_records_private.documents add constraint records_body_format_valid check(glf_records_private.valid_body_format(body,body_format));

create or replace function public.glf_records(p_action text,p_id uuid default null,p_version integer default null,p_data jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare d glf_records_private.documents; m glf_records_private.members; f glf_records_private.files; v uuid; rev uuid; seq integer; yr integer; r jsonb; item jsonb; result jsonb; kind text; code text; reason text:=trim(coalesce(p_data->>'reason','')); admin boolean; action_permission text;
begin
 if public.glf_is_active() is not true or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FORBIDDEN';end if;
 admin:=public.glf_admin_allowed();
 if p_action='bootstrap' then
  return jsonb_build_object('server_time',now(),'admin',admin,'permissions',coalesce((select jsonb_agg(distinct permission) from glf_records_private.role_permissions rp join glf_records_private.member_roles mr on mr.role_id=rp.role_id where mr.user_id=auth.uid()),'[]'),'member',(select to_jsonb(x) from glf_records_private.members x where x.user_id=auth.uid()),'units',(select jsonb_agg(to_jsonb(x) order by name) from glf_records_private.units x),'sites',(select jsonb_agg(to_jsonb(x) order by name) from glf_records_private.sites x),'signers',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'job_title',mm.job_title)) from public.glf_profiles p join glf_records_private.members mm on mm.user_id=p.id where p.active and (p.manage_users or exists(select 1 from glf_records_private.member_roles mr join glf_records_private.role_permissions rp on rp.role_id=mr.role_id where mr.user_id=p.id and rp.permission='sign'))),'[]'));
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
  if p_data ? 'contact' and length(trim(concat_ws('',p_data->'contact'->>'name',p_data->'contact'->>'job_title',p_data->'contact'->>'email',p_data->'contact'->>'phone')))>0 then
   item:=p_data->'contact';
   insert into glf_records_private.contacts(party_id,name,job_title,is_representative,email,phone) values(v,trim(coalesce(item->>'name','')),trim(coalesce(item->>'job_title','')),coalesce((item->>'is_representative')::boolean,false),lower(trim(coalesce(item->>'email',''))),trim(coalesce(item->>'phone','')));
  end if;
  insert into glf_records_private.events(actor_id,action,detail) values(auth.uid(),'party_saved',v::text);return glf_records_private.party(v);
 end if;
 if p_action='list' then
  if coalesce(p_data->>'direction','') not in ('','incoming','outgoing') then raise exception 'INVALID_DIRECTION';end if;
  return jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(x)) from (
   select dd.id,dd.direction,dd.subject,dd.status,dd.classification,dd.document_date,dd.received_at,dd.internal_number,dd.external_number,dd.year,dd.sequence,dd.due_date,dd.version,dd.author_id,dd.updated_at,(select display_name from public.glf_profiles where id=dd.author_id) author_name,p.display_name assigned_name,(select string_agg(coalesce(pp.name,s.legal_name),' · ') from glf_records_private.recipients rr join glf_records_private.parties pp on pp.id=rr.party_id left join public.glf_suppliers s on s.id=pp.supplier_id where rr.document_id=dd.id and rr.kind in('to','from')) correspondent
   from glf_records_private.documents dd left join public.glf_profiles p on p.id=dd.assigned_to
   where glf_records_private.readable(dd.id)
    and (coalesce(p_data->>'direction','')='' or dd.direction=p_data->>'direction')
    and (coalesce(p_data->>'status','')='' or dd.status=p_data->>'status')
    and (nullif(p_data->>'person_id','') is null or case when dd.direction='incoming' then dd.assigned_to else dd.author_id end=(p_data->>'person_id')::uuid)
    and (nullif(p_data->>'signer_id','') is null or dd.signer_id=(p_data->>'signer_id')::uuid)
    and (nullif(p_data->>'date_from','') is null or case when dd.direction='incoming' then (dd.received_at at time zone 'Pacific/Galapagos')::date else dd.document_date end >= (p_data->>'date_from')::date)
    and (nullif(p_data->>'date_to','') is null or case when dd.direction='incoming' then (dd.received_at at time zone 'Pacific/Galapagos')::date else dd.document_date end <= (p_data->>'date_to')::date)
    and (coalesce(p_data->>'deadline','')='' or (dd.status not in('closed','cancelled') and dd.due_date is not null and case when p_data->>'deadline'='overdue' then dd.due_date<(now() at time zone 'Pacific/Galapagos')::date else dd.due_date>=(now() at time zone 'Pacific/Galapagos')::date end))
    and (concat_ws(' ',dd.subject,dd.external_number,dd.internal_number) ilike '%'||left(coalesce(p_data->>'q',''),200)||'%'
     or exists(select 1 from glf_records_private.recipients rr join glf_records_private.parties pp on pp.id=rr.party_id left join public.glf_suppliers s on s.id=pp.supplier_id left join glf_records_private.contacts c on c.id=rr.contact_id where rr.document_id=dd.id and concat_ws(' ',pp.name,s.legal_name,s.contact_name,s.legal_rep_name,c.name) ilike '%'||left(coalesce(p_data->>'q',''),200)||'%'))
   order by dd.updated_at desc,dd.id limit 50 offset greatest(0,least(coalesce((p_data->>'offset')::int,0),100000))) x),'[]'),'draft_count',(select count(*) from glf_records_private.documents dd where dd.direction='outgoing' and dd.status='draft' and glf_records_private.readable(dd.id)));
 end if;
 if p_action='filter_people' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by p.display_name) from public.glf_profiles p where exists(select 1 from glf_records_private.documents dd where glf_records_private.readable(dd.id) and p.id in(dd.author_id,dd.signer_id,dd.assigned_to))),'[]');
 end if;
 if p_action='save' then
  if not glf_records_private.valid_body_format(p_data->>'body',p_data->'body_format') then raise exception 'INVALID_BODY_FORMAT';end if;
  kind:=p_data->>'direction';
  if kind='outgoing' then p_data:=jsonb_set(p_data,'{document_date}',to_jsonb((now() at time zone 'Pacific/Galapagos')::date));end if;
  if kind not in('outgoing','incoming') then raise exception 'INVALID_DIRECTION';end if;
  if not glf_records_private.allowed(case when kind='incoming' then 'receive' else 'create' end) then raise exception 'FORBIDDEN';end if;
  select * into m from glf_records_private.members where user_id=auth.uid();
  if not found or not exists(select 1 from glf_records_private.units where id=m.unit_id and active) or not exists(select 1 from glf_records_private.sites where id=m.site_id and active) then raise exception 'MEMBER_REQUIRED';end if;
  if kind='outgoing' then p_data:=jsonb_set(p_data,'{place}',to_jsonb((select name from glf_records_private.sites where id=m.site_id)));end if;
  if nullif(p_data->>'parent_id','') is not null and not glf_records_private.readable((p_data->>'parent_id')::uuid) then raise exception 'FORBIDDEN';end if;
  if nullif(p_data->>'signer_id','') is not null and not exists(select 1 from public.glf_profiles p join glf_records_private.members mm on mm.user_id=p.id where p.id=(p_data->>'signer_id')::uuid and p.active and (p.manage_users or exists(select 1 from glf_records_private.member_roles mr join glf_records_private.role_permissions rp on rp.role_id=mr.role_id where mr.user_id=p.id and rp.permission='sign'))) then raise exception 'INVALID_SIGNER';end if;
  if (p_data->>'document_date')::date>(now() at time zone 'Pacific/Galapagos')::date or (kind='incoming' and ((p_data->>'received_at')::timestamptz>now() or nullif(p_data->>'received_at','') is null)) then raise exception 'INVALID_DATE';end if;
  if kind='incoming' and nullif(p_data->>'signer_id','') is not null then raise exception 'INVALID_SIGNER';end if;
  if nullif(p_data->>'parent_id','') is not null and (kind<>'outgoing' or not exists(select 1 from glf_records_private.documents where id=(p_data->>'parent_id')::uuid and direction='incoming' and status<>'draft')) then raise exception 'INVALID_PARENT';end if;
  if p_id is null then
   insert into glf_records_private.documents(direction,subject,body,body_format,place,document_date,classification,status,author_id,author_profile_version,signer_id,unit_id,site_id,external_number,received_at,channel,parent_id)
   values(kind,trim(p_data->>'subject'),coalesce(p_data->>'body',''),nullif(p_data->'body_format','null'::jsonb),trim(coalesce(p_data->>'place','')),(p_data->>'document_date')::date,p_data->>'classification','draft',auth.uid(),m.version,nullif(p_data->>'signer_id','')::uuid,m.unit_id,m.site_id,trim(coalesce(p_data->>'external_number','')),nullif(p_data->>'received_at','')::timestamptz,coalesce(p_data->>'channel','email'),nullif(p_data->>'parent_id','')::uuid) returning id into v;
  else
   select * into d from glf_records_private.documents where id=p_id for update;
   if not found or not glf_records_private.readable(p_id) or d.author_id<>auth.uid() or d.direction<>kind then raise exception 'FORBIDDEN';end if;
   if d.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
   if d.status<>'draft' then raise exception 'INVALID_STATE';end if;
   update glf_records_private.documents set author_profile_version=m.version,unit_id=m.unit_id,site_id=m.site_id,subject=trim(p_data->>'subject'),body=coalesce(p_data->>'body',''),body_format=nullif(p_data->'body_format','null'::jsonb),place=trim(coalesce(p_data->>'place','')),document_date=(p_data->>'document_date')::date,classification=p_data->>'classification',signer_id=nullif(p_data->>'signer_id','')::uuid,version=version+1,updated_at=now() where id=p_id;v:=p_id;
   delete from glf_records_private.recipients where document_id=v;
  end if;
  if jsonb_typeof(coalesce(p_data->'recipients','[]'))<>'array' or jsonb_array_length(coalesce(p_data->'recipients','[]'))>30 then raise exception 'INVALID_RECIPIENT';end if;
  if kind='incoming' and not exists(select 1 from jsonb_array_elements(coalesce(p_data->'recipients','[]')) x where x->>'kind'='from') then raise exception 'RECIPIENT_REQUIRED';end if;
  for item in select value from jsonb_array_elements(coalesce(p_data->'recipients','[]')) loop
   if item->>'kind' not in(case when kind='incoming' then 'from' else 'to' end,'cc') or (kind='incoming' and item->>'kind'<>'from') then raise exception 'INVALID_RECIPIENT';end if;
   if nullif(item->>'contact_id','') is not null and not exists(select 1 from glf_records_private.contacts where id=(item->>'contact_id')::uuid and party_id=(item->>'party_id')::uuid) then raise exception 'INVALID_CONTACT';end if;
   insert into glf_records_private.recipients values(v,(item->>'party_id')::uuid,nullif(item->>'contact_id','')::uuid,item->>'kind');
  end loop;
  if kind='incoming' then update glf_records_private.documents set external_number=trim(coalesce(p_data->>'external_number','')),received_at=(p_data->>'received_at')::timestamptz,channel=coalesce(p_data->>'channel','email'),physical_location=trim(coalesce(p_data->>'physical_location','')) where id=v;end if;
  insert into glf_records_private.events(document_id,actor_id,action) values(v,auth.uid(),'saved');return to_jsonb(v);
 end if;
 -- All document operations enforce the same read guard, including IDs guessed via URLs.
 if not glf_records_private.readable(p_id) then raise exception 'FORBIDDEN';end if;
 select * into d from glf_records_private.documents where id=p_id for update;
 if p_action='read' then
  return glf_records_private.payload(p_id)||jsonb_build_object('related',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'internal_number',x.internal_number,'external_number',x.external_number,'direction',x.direction,'subject',x.subject,'status',x.status)) from glf_records_private.documents x where (x.parent_id=p_id or x.id=d.parent_id) and glf_records_private.readable(x.id)),'[]'),'revisions',coalesce((select jsonb_agg(to_jsonb(x) order by version desc) from glf_records_private.revisions x where document_id=p_id),'[]'),'files',coalesce((select jsonb_agg(to_jsonb(x)) from glf_records_private.files x where document_id=p_id and confirmed),'[]'),'events',coalesce((select jsonb_agg(to_jsonb(x)) from (select e.action,e.detail,e.created_at,p.display_name actor_name from glf_records_private.events e join public.glf_profiles p on p.id=e.actor_id where document_id=p_id order by e.id desc limit 100) x),'[]'),'dispatches',coalesce((select jsonb_agg(to_jsonb(x)) from glf_records_private.dispatches x where document_id=p_id),'[]'));
 end if;
 if p_action='register' and d.direction='incoming' and d.internal_number is not null and glf_records_private.allowed('receive') then return to_jsonb(p_id);end if;
 if d.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
 if p_action='register' then
  if d.direction<>'incoming' or d.status not in('draft','received','assigned','closed') or not glf_records_private.allowed('receive') or (d.status='draft' and d.author_id<>auth.uid()) then raise exception 'FORBIDDEN_OR_STATE';end if;
  if not exists(select 1 from glf_records_private.files where document_id=p_id and files.kind='incoming' and confirmed) then raise exception 'FILE_MISSING';end if;
  yr:=extract(year from now() at time zone 'Pacific/Galapagos');
  insert into glf_records_private.counters(year,direction,next_number) values(yr,'incoming',2) on conflict(direction,year) do update set next_number=counters.next_number+1 returning next_number-1 into seq;
  update glf_records_private.documents set status=case when status='draft' then 'received' else status end,year=yr,sequence=seq,internal_number='GLF-EXT-'||yr||'-'||lpad(seq::text,5,'0') where id=p_id;
 elsif p_action='submit' then
  if d.direction<>'outgoing' or d.author_id<>auth.uid() or not glf_records_private.allowed('create') or d.status<>'draft' or d.signer_id is null or length(trim(d.body))<10 then raise exception 'INVALID_STATE';end if;
  if not exists(select 1 from glf_records_private.recipients where document_id=p_id and recipients.kind='to') then raise exception 'RECIPIENT_REQUIRED';end if;
  update glf_records_private.documents set status='review' where id=p_id;
 elsif p_action in('approve','return') then
  if d.signer_id is distinct from auth.uid() or not glf_records_private.allowed('sign') or d.status<>'review' then raise exception 'FORBIDDEN_OR_STATE';end if;
  if p_action='return' then
   if length(reason)<5 then raise exception 'REASON_REQUIRED';end if;update glf_records_private.documents set status='draft' where id=p_id;
  else
   if not exists(select 1 from glf_records_private.members mm join glf_records_private.units u on u.id=mm.unit_id join glf_records_private.sites s on s.id=mm.site_id where mm.user_id=d.author_id and mm.version=d.author_profile_version and mm.unit_id=d.unit_id and mm.site_id=d.site_id and u.active and s.active) then raise exception 'ORIGIN_CHANGED';end if;
   yr:=extract(year from now() at time zone 'Pacific/Galapagos');
   insert into glf_records_private.counters(year,direction,next_number) values(yr,'outgoing',2) on conflict(direction,year) do update set next_number=counters.next_number+1 returning next_number-1 into seq;
   update glf_records_private.documents set status='prepared',document_date=(now() at time zone 'Pacific/Galapagos')::date,year=yr,sequence=seq,internal_number='GLF-'||yr||'-'||lpad(seq::text,5,'0') where id=p_id;
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
  if (kind='signed' and not(d.signer_id=auth.uid() and glf_records_private.allowed('sign') and d.status='prepared')) or (kind='source' and not(d.direction='outgoing' and d.author_id=auth.uid() and d.status='draft' and glf_records_private.allowed('create'))) or (kind='attachment' and not((d.direction='outgoing' and d.author_id=auth.uid() and d.status='draft' and glf_records_private.allowed('create')) or (d.direction='incoming' and d.status in('draft','received','assigned') and glf_records_private.allowed('receive')))) or (kind='incoming' and not(d.direction='incoming' and d.status in('draft','received','assigned') and glf_records_private.allowed('receive'))) or (kind='proof' and not(d.status='signed' and glf_records_private.allowed('dispatch'))) or kind not in('source','signed','attachment','incoming','proof') then raise exception 'FORBIDDEN_OR_STATE';end if;
  if (d.direction='incoming' and p_data->>'mime'<>'application/pdf') or p_data->>'mime' not in('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document') or (kind in('signed','incoming','proof') and p_data->>'mime'<>'application/pdf') then raise exception 'INVALID_FILE';end if;
  if kind='incoming' and exists(select 1 from glf_records_private.files where document_id=p_id and files.kind='incoming' and confirmed) and length(reason)<5 then raise exception 'REPLACEMENT_REASON';end if;
  select id into rev from glf_records_private.revisions where document_id=p_id order by version desc limit 1;
  v:=gen_random_uuid();
  insert into glf_records_private.files(id,document_id,revision_id,kind,filename,path,mime,size,uploaded_by) values(v,p_id,rev,kind,p_data->>'filename',p_id::text||'/'||v::text,p_data->>'mime',(p_data->>'size')::bigint,auth.uid()) returning to_jsonb(files.*) into result;
  update glf_records_private.files set change_reason=reason where id=v;return result;
 elsif p_action='confirm_upload' then
  select * into f from glf_records_private.files where id=(p_data->>'file_id')::uuid and document_id=p_id;
  if f.confirmed then raise exception 'FILE_ALREADY_CONFIRMED';end if;
  if not found or f.uploaded_by<>auth.uid() or not exists(select 1 from storage.objects where bucket_id='glf-correspondence' and name=f.path and (metadata->>'size')::bigint=f.size) then raise exception 'FILE_MISSING';end if;
  update glf_records_private.files set confirmed=true where id=f.id;
  reason:=concat_ws(' · ',f.filename,f.change_reason);
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


commit;
