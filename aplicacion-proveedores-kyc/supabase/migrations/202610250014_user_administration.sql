begin;
alter table public.glf_profiles add column manage_users boolean not null default false,
 add column user_version integer not null default 1,
 add column contact_email text not null default '';
create table glf_kyc_private.user_invitations(
 id uuid primary key default gen_random_uuid(),email text not null unique,
 display_name text not null,permissions jsonb not null,version integer not null default 1,
 expires_at timestamptz not null default now()+interval '7 days',active boolean not null default true,
 created_by uuid not null references public.glf_profiles(id),accepted_by uuid,created_at timestamptz not null default now()
);
create table glf_kyc_private.user_admin_events(id uuid primary key default gen_random_uuid(),actor_id uuid not null,
 action text not null,subject text not null,reason text not null,previous jsonb,next jsonb,created_at timestamptz not null default now());
alter table glf_kyc_private.user_invitations enable row level security;
alter table glf_kyc_private.user_admin_events enable row level security;
create function public.glf_admin_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select public.glf_is_active() and coalesce(auth.jwt()->>'aal'='aal2',false) and exists(select 1 from public.glf_profiles where id=auth.uid() and manage_users);
$$;
create function glf_kyc_private.user_permissions(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text;v text[];r jsonb:='{}';role text:=coalesce(p->>'kyc_role','none');
begin
 if role not in('none','manager') then raise exception 'INVALID_PERMISSIONS';end if;
 foreach k in array array['supplier_create_scopes','supplier_edit_scopes','supplier_archive_scopes'] loop
  if jsonb_typeof(coalesce(p->k,'[]'))<>'array' then raise exception 'INVALID_PERMISSIONS';end if;
  select coalesce(array_agg(distinct value),'{}') into v from jsonb_array_elements_text(coalesce(p->k,'[]'));
  if not v<@array['government','glf'] then raise exception 'INVALID_PERMISSIONS';end if;r=r||jsonb_build_object(k,to_jsonb(v));
 end loop;
 return r||jsonb_build_object('manage_specialties',coalesce((p->>'manage_specialties')::boolean,false),'manage_users',coalesce((p->>'manage_users')::boolean,false),'kyc_role',role);
end;$$;
create function public.glf_admin_users() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if public.glf_admin_allowed() is not true then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('users',(select coalesce(jsonb_agg(to_jsonb(p) order by display_name),'[]') from public.glf_profiles p),
 'invitations',(select coalesce(jsonb_agg(to_jsonb(i) order by created_at desc),'[]') from glf_kyc_private.user_invitations i),
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by created_at desc),'[]') from (select * from glf_kyc_private.user_admin_events order by created_at desc limit 100)e));
end;$$;
create function public.glf_admin_save_user(p_id uuid,p_version integer,p_data jsonb,p_reason text) returns boolean language plpgsql security definer set search_path='' as $$
declare old public.glf_profiles;perm jsonb:=glf_kyc_private.user_permissions(p_data);name text:=trim(p_data->>'display_name');enabled boolean:=(p_data->>'active')::boolean;
begin
 if public.glf_admin_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if p_id=auth.uid() then raise exception 'SELF_CHANGE_FORBIDDEN';end if;
 select * into old from public.glf_profiles where id=p_id for update;if not found then raise exception 'NOT_FOUND';end if;
 if old.user_version is distinct from p_version then raise exception 'STALE_VERSION';end if;
 if name is null or length(name) not between 2 and 250 or enabled is null or length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'INVALID_INPUT';end if;
 update public.glf_profiles set display_name=name,active=enabled,require_mfa=true,
 supplier_create_scopes=array(select jsonb_array_elements_text(perm->'supplier_create_scopes')),
 supplier_edit_scopes=array(select jsonb_array_elements_text(perm->'supplier_edit_scopes')),
 supplier_archive_scopes=array(select jsonb_array_elements_text(perm->'supplier_archive_scopes')),
 manage_specialties=(perm->>'manage_specialties')::boolean,manage_users=(perm->>'manage_users')::boolean,
 kyc_role=perm->>'kyc_role',kyc_until=null,user_version=user_version+1 where id=p_id;
 insert into glf_kyc_private.user_admin_events(actor_id,action,subject,reason,previous,next) values(auth.uid(),'permissions_changed',p_id::text,trim(p_reason),to_jsonb(old),perm||jsonb_build_object('active',enabled,'display_name',name));return true;
end;$$;
create function public.glf_admin_invite_user(p_email text,p_name text,p_permissions jsonb,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(p_email));name text:=trim(p_name);perm jsonb:=glf_kyc_private.user_permissions(p_permissions);v uuid;
begin
 if public.glf_admin_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>250 or name is null or length(name) not between 2 and 250 or length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'INVALID_INPUT';end if;
 if exists(select 1 from public.glf_profiles where contact_email=v_email) then raise exception 'USER_EXISTS';end if;
 insert into glf_kyc_private.user_invitations(email,display_name,permissions,created_by) values(v_email,name,perm,auth.uid()) on conflict(email) do update set display_name=excluded.display_name,permissions=excluded.permissions,active=true,expires_at=now()+interval '7 days',version=user_invitations.version+1,created_by=auth.uid() where user_invitations.accepted_by is null and (not user_invitations.active or user_invitations.expires_at<=now()) returning id into v;
 if v is null then raise exception 'INVITE_EXISTS';end if;
 insert into glf_kyc_private.user_admin_events(actor_id,action,subject,reason,next) values(auth.uid(),'invitation_created',v_email,trim(p_reason),perm);return v;
end;$$;
create function public.glf_admin_cancel_invite(p_id uuid,p_version integer,p_reason text) returns boolean language plpgsql security definer set search_path='' as $$
declare i glf_kyc_private.user_invitations;
begin
 if public.glf_admin_allowed() is not true then raise exception 'FORBIDDEN';end if;
 select * into i from glf_kyc_private.user_invitations where id=p_id for update;
 if not found or not i.active or i.version is distinct from p_version then raise exception 'STALE_VERSION';end if;
 if length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'INVALID_INPUT';end if;
 update glf_kyc_private.user_invitations set active=false,version=version+1 where id=p_id;
 insert into glf_kyc_private.user_admin_events(actor_id,action,subject,reason) values(auth.uid(),'invitation_cancelled',i.email,trim(p_reason));return true;
end;$$;
-- Accept only a prepared invitation for the exact authenticated central-identity email, with MFA.
create function public.glf_accept_internal_invitation() returns boolean language plpgsql security definer set search_path='' as $$
declare i glf_kyc_private.user_invitations;v_email text:=lower(auth.jwt()->>'email');p jsonb;
begin
 if coalesce(auth.jwt()->>'iss','')<>'https://dcxhuwghakdjcnrqkziq.supabase.co/auth/v1' or coalesce(auth.jwt()->>'role','')<>'authenticated' or coalesce(auth.jwt()->>'aud','')<>'authenticated' or coalesce(auth.jwt()->>'aal','')<>'aal2' or coalesce(auth.jwt()->>'client_id','')<>'' or auth.uid() is null then raise exception 'FORBIDDEN';end if;
 if exists(select 1 from public.glf_profiles where id=auth.uid()) then return false;end if;
 select * into i from glf_kyc_private.user_invitations where user_invitations.email=v_email and active and expires_at>now() for update;
 if not found then return false;end if;p=glf_kyc_private.user_permissions(i.permissions);
 insert into public.glf_profiles(id,display_name,contact_email,require_mfa,supplier_create_scopes,supplier_edit_scopes,supplier_archive_scopes,manage_specialties,manage_users,kyc_role)
 values(auth.uid(),i.display_name,v_email,true,array(select jsonb_array_elements_text(p->'supplier_create_scopes')),array(select jsonb_array_elements_text(p->'supplier_edit_scopes')),array(select jsonb_array_elements_text(p->'supplier_archive_scopes')),(p->>'manage_specialties')::boolean,(p->>'manage_users')::boolean,p->>'kyc_role');
 update glf_kyc_private.user_invitations set active=false,accepted_by=auth.uid(),version=version+1 where id=i.id;
 insert into glf_kyc_private.user_admin_events(actor_id,action,subject,reason,next) values(auth.uid(),'invitation_accepted',v_email,'Exact central GLF identity with MFA',p);return true;
end;$$;
revoke all on all tables in schema glf_kyc_private from public,anon,authenticated;
revoke all on function glf_kyc_private.user_permissions(jsonb) from public,anon,authenticated;
revoke all on function public.glf_admin_allowed(),public.glf_admin_users(),public.glf_admin_save_user(uuid,integer,jsonb,text),public.glf_admin_invite_user(text,text,jsonb,text),public.glf_admin_cancel_invite(uuid,integer,text),public.glf_accept_internal_invitation() from public,anon;
grant execute on function public.glf_admin_allowed(),public.glf_admin_users(),public.glf_admin_save_user(uuid,integer,jsonb,text),public.glf_admin_invite_user(text,text,jsonb,text),public.glf_admin_cancel_invite(uuid,integer,text),public.glf_accept_internal_invitation() to authenticated;
-- No administrator is granted here. Initial activation is a separate, explicit decision.
create or replace function public.glf_kyc_delegate(p_target uuid,p_until timestamptz,p_reason text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not public.glf_kyc_allowed() or not exists(select 1 from public.glf_profiles where id=auth.uid() and kyc_role='manager') then raise exception 'FORBIDDEN';end if;
 if p_target=auth.uid() or length(trim(p_reason)) not between 5 and 1000 or (p_until is not null and (p_until<=now() or p_until>now()+interval '30 days')) then raise exception 'INVALID_DELEGATION';end if;
 update public.glf_profiles set kyc_role=case when p_until is null then 'none' else 'delegate' end,kyc_until=p_until,user_version=user_version+1 where id=p_target and active and kyc_role<>'manager';
 if not found then raise exception 'INVALID_DELEGATION';end if;
 insert into public.glf_kyc_delegation_audit(actor_id,target_id,until_at,reason) values(auth.uid(),p_target,p_until,trim(p_reason));return true;
end;$$;
commit;
