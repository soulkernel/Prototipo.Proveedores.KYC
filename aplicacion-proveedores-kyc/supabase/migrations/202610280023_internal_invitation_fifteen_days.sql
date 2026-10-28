-- Internal access authorizations only; supplier KYC form invitations retain seven days.
begin;
alter table glf_kyc_private.user_invitations alter column expires_at set default now()+interval '15 days';
create or replace function public.glf_admin_invite_user(p_email text,p_name text,p_permissions jsonb,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(p_email));name text:=trim(p_name);perm jsonb:=glf_kyc_private.user_permissions(p_permissions);v uuid;
begin
 if public.glf_admin_allowed() is not true then raise exception 'FORBIDDEN';end if;
 if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>250 or name is null or length(name) not between 2 and 250 or length(trim(coalesce(p_reason,''))) not between 5 and 1000 then raise exception 'INVALID_INPUT';end if;
 if exists(select 1 from public.glf_profiles where contact_email=v_email) then raise exception 'USER_EXISTS';end if;
 insert into glf_kyc_private.user_invitations(email,display_name,permissions,created_by) values(v_email,name,perm,auth.uid()) on conflict(email) do update set display_name=excluded.display_name,permissions=excluded.permissions,active=true,expires_at=now()+interval '15 days',version=user_invitations.version+1,created_by=auth.uid() where user_invitations.accepted_by is null and (not user_invitations.active or user_invitations.expires_at<=now()) returning id into v;
 if v is null then raise exception 'INVITE_EXISTS';end if;
 insert into glf_kyc_private.user_admin_events(actor_id,action,subject,reason,next) values(auth.uid(),'invitation_created',v_email,trim(p_reason),perm);return v;
end;$$;

with extended as (
 update glf_kyc_private.user_invitations i set expires_at=i.created_at+interval '15 days',version=i.version+1
 where i.active and i.accepted_by is null and i.expires_at>now() and i.expires_at<i.created_at+interval '15 days'
 and not exists(select 1 from glf_kyc_private.user_admin_events e where e.subject=i.email and e.action='invitation_validity_extended' and e.reason='Vigencia de acceso interno ampliada a 15 días por instrucción del usuario el 28 de octubre de 2026.')
 returning i.email,i.created_by,i.expires_at
)
insert into glf_kyc_private.user_admin_events(actor_id,action,subject,reason,next)
select created_by,'invitation_validity_extended',email,'Vigencia de acceso interno ampliada a 15 días por instrucción del usuario el 28 de octubre de 2026.',jsonb_build_object('expires_at',expires_at,'days',15) from extended;
commit;
