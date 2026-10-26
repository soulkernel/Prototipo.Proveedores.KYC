begin;
-- Closed/submitted snapshots retain their original form version. Open drafts adopt current rules only on external save.
alter table public.glf_kyc_cases alter column form_version set default '2026-10-25.2';
create or replace function public.glf_kyc_save(p_token text,p_version integer,p_answers jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare cid uuid:=glf_kyc_private.token_case(p_token);c public.glf_kyc_cases;a jsonb;
begin
 if cid is null then raise exception 'LINK_INVALID';end if;select * into c from public.glf_kyc_cases where id=cid for update;
 if c.state<>'invited' or glf_kyc_private.token_case(p_token) is distinct from cid then raise exception 'LINK_INVALID';end if;
 if c.version<>p_version then raise exception 'STALE_VERSION';end if;
 if jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>100000 then raise exception 'INVALID';end if;
 a=glf_kyc_private.project(p_answers);if a->>'relation' is distinct from c.relation then raise exception 'ROUTE_MISMATCH';end if;
 if c.answers=a and c.form_version='2026-10-25.2' then return c.version;end if;
 update public.glf_kyc_cases set answers=a,form_version='2026-10-25.2',version=version+1,pdf_version=null,updated_at=now() where id=cid returning version into p_version;
 return p_version;
end;$$;
commit;
