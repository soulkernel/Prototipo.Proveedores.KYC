import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {database,ids,as,call} from './records-fixture.mjs';import {day} from '../src/records-model.js';
test('Upgrade preserves issued number and counter; incoming sequence is independent; replacement requires reason',async()=>{
 const db=await database({through:'202611130026'});try{
  await db.query('insert into glf_profiles(id,display_name,manage_users) values($1,$2,true)',[ids.admin,'Administrador de prueba']);
  const run=fn=>as(db,ids.admin,fn),rpc=(a,id,v,d)=>call(db,a,id,v,d);const boot=await run(()=>rpc('bootstrap'));
  await run(()=>rpc('member',null,null,{user_id:ids.admin,unit_id:boot.units[0].id,site_id:boot.sites[0].id,initials:'QA',job_title:'Pruebas',roles:[],reason:'Configuración de prueba'}));
  const p=await run(()=>rpc('party',null,null,{name:'Contraparte de prueba',kind:'institution'}));
  const base={direction:'outgoing',subject:'Prueba migración',body:'Contenido de oficio sintético.',document_date:day(),classification:'ordinary',signer_id:ids.admin,recipients:[{kind:'to',party_id:p.id}]};
  const old=await run(()=>rpc('save',null,null,base));await run(()=>rpc('submit',old,1));await run(()=>rpc('approve',old,2));
  const prior=await run(()=>rpc('read',old));
  await db.exec(await fs.readFile(new URL('../supabase/migrations/202611130027_records_inbox_outbox.sql',import.meta.url),'utf8'));
  const unchanged=await run(()=>rpc('read',old));assert.equal(unchanged.internal_number,'C-GLF-0001-'+day().slice(0,4));assert.deepEqual(unchanged.revisions,prior.revisions);
  const newer=await run(()=>rpc('save',null,null,base));await run(()=>rpc('submit',newer,1));await run(()=>rpc('approve',newer,2));assert.equal((await run(()=>rpc('read',newer))).internal_number,'GLF-'+day().slice(0,4)+'-00002');
  const incoming=await run(()=>rpc('save',null,null,{...base,direction:'incoming',signer_id:null,external_number:'ORIG-01',received_at:new Date().toISOString(),recipients:[{kind:'from',party_id:p.id}]}));
  const meta={kind:'incoming',filename:'escaneo.pdf',mime:'application/pdf',size:50};const ticket=await run(()=>rpc('upload',incoming,1,meta));
  await db.query("insert into storage.objects(bucket_id,name,metadata) values('glf-correspondence',$1,$2)",[ticket.path,JSON.stringify({size:50})]);await run(()=>rpc('confirm_upload',incoming,1,{file_id:ticket.id}));await run(()=>rpc('register',incoming,2));
  assert.equal((await run(()=>rpc('read',incoming))).internal_number,'GLF-EXT-'+day().slice(0,4)+'-00001');
  await assert.rejects(run(()=>rpc('upload',incoming,3,meta)),/REPLACEMENT_REASON/);
  await run(()=>rpc('upload',incoming,3,{...meta,reason:'Escaneo más legible'}));assert.equal((await db.query('select count(*)::int n from glf_records_private.files where document_id=$1',[incoming])).rows[0].n,2);
 }finally{await db.close();}
});
