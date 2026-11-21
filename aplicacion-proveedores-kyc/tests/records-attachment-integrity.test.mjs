import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {database,ids,as,call} from './records-fixture.mjs';
test('F01: pending uploads cannot cross submission, approval, cancellation or document versions',async()=>{
 const db=await database({through:'202611210033'});try{
  for(const n of ['admin','reader'])await db.query('insert into glf_profiles(id,display_name,manage_users) values($1,$2,$3)',[ids[n],n,n==='admin']);
  const rpc=(a,id=null,v=null,d={})=>as(db,ids.admin,()=>call(db,a,id,v,d));const boot=await rpc('bootstrap');await rpc('member',null,null,{user_id:ids.admin,unit_id:boot.units[0].id,site_id:boot.sites[0].id,initials:'QA',job_title:'Prueba',roles:[],reason:'Configuración sintética'});
  const p=await rpc('party',null,null,{kind:'institution',name:'Entidad QA'}),base={direction:'outgoing',subject:'Integridad de anexos',body:'Texto suficiente de prueba.',signer_id:ids.admin,classification:'ordinary',recipients:[{kind:'to',party_id:p.id}]};
  const legacy=await rpc('save',null,null,base);let d=await rpc('read',legacy);const old=await rpc('upload',legacy,d.version,{kind:'attachment',filename:'pendiente-anterior.pdf',mime:'application/pdf',size:20});
  const reviewing=await rpc('save',null,null,base);let rd=await rpc('read',reviewing);const reviewTicket=await rpc('upload',reviewing,rd.version,{kind:'attachment',filename:'previo-en-revision.pdf',mime:'application/pdf',size:20});await rpc('submit',reviewing,rd.version);
  await db.exec(await fs.readFile(new URL('../supabase/migrations/202611210034_records_attachment_integrity.sql',import.meta.url),'utf8'));
  async function object(f){await db.query("insert into storage.objects(bucket_id,name,metadata) values('glf-correspondence',$1,$2)",[f.path,JSON.stringify({size:20})]);}
  async function ticket(id,kind='attachment'){const doc=await rpc('read',id);return rpc('upload',id,doc.version,{kind,filename:kind+'.pdf',mime:'application/pdf',size:20});}
  rd=await rpc('read',reviewing);await assert.rejects(rpc('approve',reviewing,rd.version),/PENDING_UPLOADS/);await object(reviewTicket);await assert.rejects(rpc('confirm_upload',reviewing,rd.version,{file_id:reviewTicket.id}),/UPLOAD_NO_LONGER_VALID/);
  await object(old);await assert.rejects(rpc('confirm_upload',legacy,d.version,{file_id:old.id}),/UPLOAD_NO_LONGER_VALID/);
  await assert.rejects(rpc('submit',legacy,d.version),/PENDING_UPLOADS/);
  await assert.rejects(as(db,ids.reader,()=>call(db,'discard_pending_upload',legacy,d.version,{file_id:old.id})),/FORBIDDEN/);
  await rpc('discard_pending_upload',legacy,d.version,{file_id:old.id});d=await rpc('read',legacy);assert.equal(d.pending_uploads.length,0);assert.equal(d.files.length,0);assert.equal(d.events[0].action,'discard_pending_upload');
  assert.equal((await as(db,ids.admin,()=>db.query('select glf_records_file_allowed($1,true) ok',[old.path]))).rows[0].ok,false);
  await assert.rejects(rpc('confirm_upload',legacy,d.version,{file_id:old.id}),/UPLOAD_NO_LONGER_VALID/);
  // Interleaving A: upload starts before another session submits. Submission is blocked.
  const f=await ticket(legacy);await object(f);d=await rpc('read',legacy);await assert.rejects(rpc('submit',legacy,d.version),/PENDING_UPLOADS/);await rpc('confirm_upload',legacy,d.version,{file_id:f.id});d=await rpc('read',legacy);await rpc('submit',legacy,d.version);d=await rpc('read',legacy);
  // Interleaving B: submission wins. A later upload cannot start.
  await assert.rejects(rpc('upload',legacy,d.version,{kind:'attachment',filename:'late.pdf',mime:'application/pdf',size:20}),/FORBIDDEN_OR_STATE/);await rpc('approve',legacy,d.version);d=await rpc('read',legacy);assert.equal(d.revisions[0].snapshot.attachments.length,1);
  // Old cancelled ticket cannot be resurrected with the freshly read version.
  await assert.rejects(rpc('confirm_upload',legacy,d.version,{file_id:old.id}),/UPLOAD_NO_LONGER_VALID/);assert.equal((await rpc('read',legacy)).files.length,1);
  const v=await rpc('save',null,null,base),stale=await ticket(v);await object(stale);let vd=await rpc('read',v);await rpc('save',v,vd.version,base);vd=await rpc('read',v);await assert.rejects(rpc('confirm_upload',v,vd.version,{file_id:stale.id}),/UPLOAD_NO_LONGER_VALID/);
  // Dispatch must use only IDs frozen in the approved revision.
  const signed=await ticket(legacy,'signed');await object(signed);d=await rpc('read',legacy);await rpc('confirm_upload',legacy,d.version,{file_id:signed.id});d=await rpc('read',legacy);await rpc('verify',legacy,d.version,{file_id:signed.id,reason:'Verificación sintética de firma'});d=await rpc('read',legacy);
  await db.query("insert into glf_records_private.files(document_id,kind,filename,path,mime,size,uploaded_by,confirmed) values($1,'attachment','fuera-de-version.pdf','fixture/outside','application/pdf',19999999,$2,true)",[legacy,ids.admin]);
  const dispatch=(await as(db,ids.admin,()=>db.query("select glf_records_prepare_dispatch($1,$2,'qa@example.test','Oficio QA','Mensaje sintético') id",[legacy,d.version]))).rows[0].id;
  await db.exec('set role service_role');const payload=(await db.query("select glf_records_dispatch_worker($1,'claim') result",[dispatch])).rows[0].result;await db.exec('reset role');assert.deepEqual(payload.files.map(x=>x.filename).sort(),['attachment.pdf','signed.pdf']);
  await assert.rejects(as(db,ids.admin,()=>db.query("select glf_records_private.approved_dispatch_files($1,$2)",[legacy,signed.id])),/permission denied/);
 }finally{await db.close();}
});
