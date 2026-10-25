-- Optional commercial images. No public files, no changes to identity or KYC access.
begin;
alter table public.glf_suppliers add column image_path text
 check(image_path is null or (length(image_path)<200 and split_part(image_path,'/',1)=id::text and image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('glf-supplier-images','glf-supplier-images',false,204800,array['image/webp']);
create function public.glf_image_can_edit(p_path text) returns boolean
 language sql stable security definer set search_path='' as $$
 select p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' and exists(
 select 1 from public.glf_suppliers s where s.id::text=split_part(p_path,'/',1) and public.glf_can('edit',s.scope));
$$;
create policy glf_supplier_image_read on storage.objects for select to authenticated using(
 bucket_id='glf-supplier-images' and public.glf_is_active() and
 (exists(select 1 from public.glf_suppliers s where s.image_path=name) or public.glf_image_can_edit(name)));
create policy glf_supplier_image_insert on storage.objects for insert to authenticated with check(
 bucket_id='glf-supplier-images' and public.glf_image_can_edit(name));
-- Files are immutable. Delete only unreferenced objects in an editable supplier folder.
create policy glf_supplier_image_delete on storage.objects for delete to authenticated using(
 bucket_id='glf-supplier-images' and public.glf_image_can_edit(name) and
 not exists(select 1 from public.glf_suppliers s where s.image_path=name));
create function public.glf_set_supplier_image(p_id uuid,p_expected_version integer,p_path text default null)
 returns void language plpgsql security definer set search_path='' as $$
declare v public.glf_suppliers;v_after jsonb;
begin
 select * into v from public.glf_suppliers where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if not public.glf_can('edit',v.scope) then raise exception 'FORBIDDEN';end if;
 if p_expected_version is distinct from v.version then raise exception 'STALE_VERSION';end if;
 if p_path is not null and (split_part(p_path,'/',1)<>p_id::text or not public.glf_image_can_edit(p_path) or not exists(
  select 1 from storage.objects o where o.bucket_id='glf-supplier-images' and o.name=p_path
  and o.metadata->>'mimetype'='image/webp' and (o.metadata->>'size')::bigint between 1 and 204800)) then raise exception 'INVALID_IMAGE';end if;
 update public.glf_suppliers set image_path=p_path,version=version+1,updated_at=now(),updated_by=auth.uid() where id=p_id returning to_jsonb(glf_suppliers.*) into v_after;
 insert into public.glf_supplier_audit(supplier_id,actor_id,actor_name,action,reason,previous,current_data)
 select p_id,id,display_name,case when p_path is null then 'image_removed' else 'image_updated' end,
 'Imagen comercial / Commercial image',to_jsonb(v),v_after from public.glf_profiles where id=auth.uid();
end;$$;
revoke all on function public.glf_image_can_edit(text),public.glf_set_supplier_image(uuid,integer,text) from public,anon;
grant execute on function public.glf_image_can_edit(text),public.glf_set_supplier_image(uuid,integer,text) to authenticated;
commit;
