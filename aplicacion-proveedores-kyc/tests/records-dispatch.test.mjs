import test from 'node:test';import assert from 'node:assert/strict';import {database,ids,as,call} from './records-fixture.mjs';import {buildMail} from '../supabase/functions/correspondence-send/mime.mjs';
test('Mail MIME preserves attachment bytes, accents and rejects header injection',()=>{
 const bytes=new Uint8Array([37,80,68,70,45,0,255]);
 const raw=buildMail({from:'info@example.test',to:'qa@example.test, second@example.test',cc:'copy@example.test',replyTo:'info@example.test',subject:'Oficio con acentuación',message:'Texto íntegro',attachments:[{filename:'oficio firmado.pdf',mime:'application/pdf',bytes}],messageId:'qa@example.test'});
 const decoded=Buffer.from(raw,'base64url').toString('utf8');assert.ok(decoded.includes(Buffer.from(bytes).toString('base64')));assert.ok(decoded.includes('filename*=UTF-8'));assert.ok(decoded.includes('To: qa@example.test, second@example.test'));assert.ok(decoded.includes('Cc: copy@example.test'));assert.throws(()=>buildMail({from:'a@example.test\r\nBcc: evil@example.test',to:'q@example.test',subject:'abc',message:'abc',attachments:[],messageId:'qa@example.test'}),/INVALID_HEADER/);
});
test('Gmail queue rejects unauthorized work and uncertain delivery cannot be resent',async()=>{
 const db=await database();try{
  await db.query('insert into glf_profiles(id,display_name,manage_users) values($1,$2,true)',[ids.admin,'QA']);
  const boot=await as(db,ids.admin,()=>call(db,'bootstrap'));await as(db,ids.admin,()=>call(db,'member',null,null,{user_id:ids.admin,unit_id:boot.units[0].id,site_id:boot.sites[0].id,initials:'QA',job_title:'Administrador prueba',roles:[],reason:'Configuración prueba'}));
  const doc=(await db.query("insert into glf_records_private.documents(direction,subject,status,author_id,signer_id,unit_id,site_id) values('outgoing','Prueba despacho','signed',$1,$1,$2,$3) returning id",[ids.admin,boot.units[0].id,boot.sites[0].id])).rows[0].id;
  const file=(await db.query("insert into glf_records_private.files(document_id,kind,filename,path,mime,size,uploaded_by,confirmed) values($1,'signed','firmado.pdf','fixture/path','application/pdf',20,$2,true) returning id",[doc,ids.admin])).rows[0].id;
  await db.query("insert into glf_records_private.signature_reviews values($1,$2,'Revisión sintética completa',now())",[file,ids.admin]);
  const prepare=()=>db.query("select glf_records_prepare_dispatch($1,1,'qa@example.test','Oficio de prueba','Mensaje de prueba') id",[doc]);
  assert.equal((await db.query("select glf_records_private.valid_emails('a@example.test, b@example.test') ok")).rows[0].ok,true);assert.equal((await db.query("select glf_records_private.valid_emails('a@example.test,') ok")).rows[0].ok,false);
  const id=(await as(db,ids.admin,prepare)).rows[0].id;assert.equal((await as(db,ids.admin,prepare)).rows[0].id,id);
  await assert.rejects(as(db,ids.admin,()=>db.query("select glf_records_dispatch_worker($1,'claim',null)",[id])),/permission denied/);
  await db.exec('set role service_role');const claim=(await db.query("select glf_records_dispatch_worker($1,'claim',null) result",[id])).rows[0].result;assert.equal(claim.files[0].filename,'firmado.pdf');
  await assert.rejects(db.query("select glf_records_dispatch_worker($1,'claim',null)",[id]),/ALREADY_CLAIMED/);await db.query("select glf_records_dispatch_worker($1,'uncertain',null)",[id]);await db.exec('reset role');
  await assert.rejects(as(db,ids.admin,prepare),/duplicate key/);assert.equal((await db.query('select status from glf_records_private.documents where id=$1',[doc])).rows[0].status,'signed');
 }finally{await db.close();}
});
