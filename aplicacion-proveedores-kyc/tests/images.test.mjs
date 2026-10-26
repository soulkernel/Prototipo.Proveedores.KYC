import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {emptySupplier} from '../src/domain.js';
test('Private supplier images enforce scope, MFA, ownership, immutable files and version checks',async()=>{
 const db=new PGlite(),actor='00000000-0000-4000-8000-000000000001',viewer='00000000-0000-4000-8000-000000000002';
 const jwt={sub:actor,iss:'https://dcxhuwghakdjcnrqkziq.supabase.co/auth/v1',role:'authenticated',aud:'authenticated',aal:'aal2'};
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
   create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;
   grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
  for(const name of ['202610250001_supplier_directory.sql','202610250002_shared_identity.sql','202610250003_supplier_images.sql','202610250004_supplier_details.sql','202610250005_supplier_email_limit.sql','202610250006_supplier_phones.sql','202610250007_supplier_phone_format.sql'])await db.exec(await fs.readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
  await db.query('insert into glf_profiles(id,display_name,supplier_create_scopes,supplier_edit_scopes) values($1,$2,$3,$3)',[actor,'Ficticio',['government']]);
  await db.query("insert into glf_profiles(id,display_name) values($1,'Lector')",[viewer]);
  const sp=(await db.query("insert into glf_specialties(name) values('Prueba') returning id")).rows[0].id;
  async function as(claims,fn){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
  const input={...emptySupplier(),legal_name:'Ficticio',id_number:'0000000001',email:'a@example.test',phone:'0000',city:'Quito',specialty_ids:[sp]};
  const id=await as(jwt,async()=> (await db.query('select glf_save_supplier($1::jsonb) id',[JSON.stringify(input)])).rows[0].id);
  const path=id+'/00000000-0000-4000-8000-000000000010.webp';
  assert.equal((await db.query('select public from storage.buckets')).rows[0].public,false);
  await as(jwt,()=>db.query("insert into storage.objects(bucket_id,name,metadata) values('glf-supplier-images',$1,$2)",[path,{size:1000,mimetype:'image/webp'}]));
  await as({...jwt,sub:viewer},async()=>{
   assert.equal((await db.query('select * from storage.objects')).rows.length,0,'Pending files not exposed to readers');
   await assert.rejects(db.query('select glf_set_supplier_image($1,1,$2)',[id,path]),/FORBIDDEN/);
   await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('glf-supplier-images',$1)",[path]),/row-level security/);
  });
  await as({...jwt,aal:'aal1'},()=>assert.rejects(db.query('select glf_set_supplier_image($1,1,$2)',[id,path]),/FORBIDDEN/));
  await as(jwt,async()=>{
   await assert.rejects(db.query('select glf_set_supplier_image($1,1,$2)',[id,'00000000-0000-4000-8000-000000000099/00000000-0000-4000-8000-000000000010.webp']),/INVALID_IMAGE/);
   await db.query('select glf_set_supplier_image($1,1,$2)',[id,path]);
   await assert.rejects(db.query('select glf_set_supplier_image($1,1,null)',[id]),/STALE_VERSION/);
   assert.equal((await db.query('delete from storage.objects returning name')).rows.length,0,'Referenced image cannot be deleted');
   assert.equal((await db.query("update storage.objects set metadata='{}' returning name")).rows.length,0,'Objects cannot be overwritten');
  });
  await as({...jwt,sub:viewer},async()=>assert.equal((await db.query('select * from storage.objects')).rows.length,1));
  await as({...jwt,iss:'https://untrusted.example'},async()=>assert.equal((await db.query('select * from storage.objects')).rows.length,0));
  await as(jwt,async()=>{await db.query('select glf_set_supplier_image($1,2,null)',[id]);assert.equal((await db.query('delete from storage.objects returning name')).rows.length,1);});
  assert.deepEqual((await db.query("select action from glf_supplier_audit order by id")).rows.map(r=>r.action),['created','image_updated','image_removed']);
 }finally{await db.close();}
});
