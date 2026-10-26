import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {emptySupplier,normalizeSupplier,validateSupplier,isDuplicate,can,searchSuppliers} from '../src/domain.js';
test('Identity, shared scope and additional email domain rules',()=>{
 const a=normalizeSupplier({...emptySupplier('shared'),id_type:'ruc',id_number:'0000000001001',legal_name:'Demo',email:'a@example.test',phone:'0',city:'Quito',specialty_ids:['x']});
 assert.equal(a.person_type,'natural');assert.equal(a.id_type,'ruc');assert.deepEqual(validateSupplier(a),[]);
 assert.ok(isDuplicate(a,{...a,id_type:'cedula',id_number:'0000000001'}));assert.ok(!isDuplicate({...a,id_country_code:'US',id_type:'passport'},{...a,id_country_code:'GB',id_type:'passport'}));
 assert.ok(can({active:true,supplier_edit_scopes:['glf']},'edit','shared'));assert.ok(!can({active:true,supplier_edit_scopes:[]},'edit','shared'));
 assert.equal(searchSuppliers([a],[],{scope:'government',status:'active'}).length,1);
 const emails=Array.from({length:4},(_,i)=>({label:'billing',email:`extra${i}@example.test`}));
 assert.deepEqual(validateSupplier({...a,additional_emails:emails.slice(0,3)}),[]);
 assert.ok(validateSupplier({...a,additional_emails:emails}).includes('additional_emails'));
 assert.ok(validateSupplier({...a,additional_emails:[{label:'billing',email:a.email}]}).includes('additional_emails'));
});
test('Database: shared edits, country/document duplicates, atomic enforcement and emails',async()=>{
 const db=new PGlite();const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.jwt(),auth.uid() to authenticated;`);
 for(const file of ['202610250001_supplier_directory.sql','202610250002_shared_identity.sql','202610250004_supplier_details.sql','202610250005_supplier_email_limit.sql'])await db.exec(await fs.readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 for(let i=0;i<3;i++)await db.query('insert into glf_profiles(id,display_name,supplier_create_scopes,supplier_edit_scopes) values($1,$2,$3,$3)',[ids[i],'Test '+i,i===0?['government']:i===1?['glf']:[]]);
 const sp=(await db.query("insert into glf_specialties(name) values('Prueba') returning id")).rows[0].id;
 const input=normalizeSupplier({...emptySupplier('shared'),id_type:'ruc',id_number:'0000000001001',legal_name:'Demo',email:'demo@example.test',phone:'0',city:'Santa Cruz',specialty_ids:[sp],additional_emails:[{label:'billing',email:'billing@example.test'}]});
 const save=(s,version=null)=>db.query('select glf_save_supplier($1::jsonb,$2) id',[JSON.stringify(s),version]);
 async function as(i,fn,aal='aal2'){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:ids[i],iss:'https://dcxhuwghakdjcnrqkziq.supabase.co/auth/v1',aud:'authenticated',role:'authenticated',aal})]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
 const id=await as(0,async()=>(await save(input)).rows[0].id);
 await assert.rejects(db.query('update glf_suppliers set additional_emails=$1::jsonb where id=$2',[JSON.stringify(Array.from({length:4},(_,i)=>({label:'billing',email:`extra${i}@example.test`}))),id]),/glf_supplier_email_limit/);
 await as(1,async()=>{await save({...input,id,legal_name:'Edited by GLF'},1);await assert.rejects(save({...input,id,scope:'glf'},2),/FORBIDDEN/);assert.equal((await db.query('select additional_emails from glf_suppliers where id=$1',[id])).rows[0].additional_emails[0].email,'billing@example.test');await assert.rejects(save({...input,id},1),/STALE_VERSION/);});
 await as(0,async()=>{const match=(await db.query('select glf_find_supplier_duplicates($1::jsonb) ids',[JSON.stringify({...input,id_type:'cedula',id_number:'0000000001'})])).rows[0].ids;assert.deepEqual(match,[id]);await assert.rejects(save({...input,id_type:'cedula',id_number:'0000000001'}),/duplicate key/);await assert.rejects(save({...input,id_number:'0000000002001',additional_emails:[{label:'billing',email:'demo@example.test'}]}),/check constraint/);
 for(const country of ['US','GB'])await save({...input,scope:'government',id_type:'passport',id_country_code:country,id_number:'AB12345'});
 await assert.rejects(save({...input,scope:'government',id_type:'passport',id_country_code:'US',id_number:'AB12345'}),/duplicate key/);
 await assert.rejects(save({...input,id,scope:'government'},2),/FORBIDDEN/);
 assert.equal((await db.query('select count(*)::int n from glf_supplier_audit where supplier_id=$1',[id])).rows[0].n,2);});
 await as(2,async()=>{assert.equal((await db.query('select * from glf_suppliers')).rows.length,3);await assert.rejects(save({...input,id},2),/FORBIDDEN/);});
 await as(0,()=>assert.rejects(db.query('select glf_find_supplier_duplicates($1::jsonb)',[JSON.stringify(input)]),/FORBIDDEN/),'aal1');
 }finally{await db.close();}
});
