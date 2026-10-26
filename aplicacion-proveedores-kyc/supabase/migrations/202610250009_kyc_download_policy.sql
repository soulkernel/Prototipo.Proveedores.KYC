begin;
-- Qualify the outer Storage object: glf_kyc_files also has a name column.
alter policy kyc_private_download on storage.objects using(
 bucket_id='glf-kyc-documents' and public.glf_kyc_allowed()
 and exists(select 1 from public.glf_kyc_files f where f.path=storage.objects.name)
);
create or replace function public.glf_kyc_read(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=glf_kyc_private.token_case(p_token);c public.glf_kyc_cases;
begin
 if cid is null then raise exception 'LINK_INVALID';end if;select * into c from public.glf_kyc_cases where id=cid;
 return jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'relation',c.relation,'answers',c.answers,'version',c.version,'pdf_version',c.pdf_version,'form_version',c.form_version,'allow_scan',c.allow_scan,'note',c.note,'expires_at',(select expires_at from glf_kyc_private.invitations where case_id=cid),'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'slot',f.slot,'name',f.name,'bytes',f.bytes,'version',f.version) order by f.created_at desc,f.id desc) from public.glf_kyc_files f where f.case_id=cid and f.version=c.version),'[]'::jsonb));
end;$$;
commit;
