-- Trust an existing GLF identity; do not copy passwords or create auth.users.
-- Requires a Supabase Third-Party Auth / Custom OIDC integration for this issuer.
begin;
alter table public.glf_profiles drop constraint glf_profiles_id_fkey;
alter table public.glf_profiles
 add column identity_issuer text not null default 'https://dcxhuwghakdjcnrqkziq.supabase.co/auth/v1'
 check(identity_issuer='https://dcxhuwghakdjcnrqkziq.supabase.co/auth/v1'),
 add column require_mfa boolean not null default true;

create function public.glf_identity_matches() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(
  auth.jwt()->>'iss'='https://dcxhuwghakdjcnrqkziq.supabase.co/auth/v1'
  and auth.jwt()->>'aud'='authenticated'
  and auth.jwt()->>'role'='authenticated'
  -- OAuth clients will be authorized explicitly when cross-app SSO is added.
  and coalesce(auth.jwt()->>'client_id','')=''
  and exists(select 1 from public.glf_profiles p
   where p.id=auth.uid() and p.identity_issuer=auth.jwt()->>'iss'),false);
$$;
create or replace function public.glf_is_active() returns boolean
language sql stable security definer set search_path='' as $$
 select public.glf_identity_matches() and exists(select 1 from public.glf_profiles p
 where p.id=auth.uid() and p.active
 and (not p.require_mfa or coalesce(auth.jwt()->>'aal','')='aal2'));
$$;
create or replace function public.glf_can(p_action text,p_scope text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.glf_is_active() and coalesce((select p_scope=any(case p_action
 when 'create' then p.supplier_create_scopes when 'edit' then p.supplier_edit_scopes
 when 'archive' then p.supplier_archive_scopes else '{}'::text[] end)
 from public.glf_profiles p where p.id=auth.uid()),false);
$$;
alter policy profile_self on public.glf_profiles
 using(id=auth.uid() and public.glf_identity_matches());

create or replace function public.glf_add_specialty(p_name text) returns public.glf_specialties
language plpgsql security definer set search_path='' as $$
declare v public.glf_specialties;
begin
 if not public.glf_is_active() or not exists(select 1 from public.glf_profiles
 where id=auth.uid() and active and manage_specialties) then raise exception 'FORBIDDEN';end if;
 if public.glf_label(p_name)='' then raise exception 'INVALID_SPECIALTY';end if;
 insert into public.glf_specialties(name,created_by) values(trim(p_name),auth.uid()) on conflict(normalized_name) do nothing;
 select * into v from public.glf_specialties where normalized_name=public.glf_label(p_name);return v;
end;$$;
revoke all on function public.glf_identity_matches() from public,anon;
grant execute on function public.glf_identity_matches() to authenticated;
commit;
