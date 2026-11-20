import test from 'node:test';
import assert from 'node:assert/strict';
import {database,ids,as,call} from './records-fixture.mjs';
import {day} from '../src/records-model.js';
import {attentionStatus,latestMainFile,replyTemplate} from '../src/records-followup.js';

test('Follow-up: assignment, evidence, linked reply, confidentiality and real dispatch milestones',async()=>{
 const db=await database();
 try{
  for(const [name,id] of Object.entries(ids))await db.query('insert into glf_profiles(id,display_name,manage_users) values($1,$2,$3)',[id,name,name==='admin']);
  const run=(name,fn,aal)=>as(db,ids[name],fn,aal),rpc=(a,id,v,d)=>call(db,a,id,v,d);
  const boot=await run('admin',()=>rpc('bootstrap')),admin=await run('admin',()=>rpc('admin'));
  for(const [name,roles] of [['writer',['Redacción']],['signer',['Firma']],['receiver',['Recepción y archivo','Despacho','Redacción']]])await run('admin',()=>rpc('member',null,null,{user_id:ids[name],unit_id:boot.units[0].id,site_id:boot.sites[0].id,initials:name.slice(0,2).toUpperCase(),job_title:'Prueba',roles:admin.roles.filter(r=>roles.includes(r.name)).map(r=>r.id),reason:'Configuración de prueba'}));
  const party=await run('receiver',()=>rpc('party',null,null,{kind:'institution',name:'Entidad sintética',contact:{name:'Representante sintético',email:'qa@example.test',is_representative:true}}));
  const base={direction:'incoming',subject:'Solicitud de información',body:'Resumen del oficio',external_number:'EXT-123',document_date:day(),received_at:new Date().toISOString(),channel:'email',classification:'ordinary',recipients:[{kind:'from',party_id:party.id,contact_id:party.contacts[0].id}]};
  const read=(name,id)=>run(name,()=>rpc('read',id));
  async function upload(name,id,kind){const d=await read(name,id),f=await run(name,()=>rpc('upload',id,d.version,{kind,filename:kind+'.pdf',mime:'application/pdf',size:20}));await db.query("insert into storage.objects(bucket_id,name,metadata) values('glf-correspondence',$1,$2)",[f.path,JSON.stringify({size:20})]);await run(name,()=>rpc('confirm_upload',id,d.version,{file_id:f.id}));return f;}
  async function incoming(classification='ordinary'){const id=await run('receiver',()=>rpc('save',null,null,{...base,classification}));await upload('receiver',id,'incoming');await upload('receiver',id,'attachment');const d=await read('receiver',id);await run('receiver',()=>rpc('register',id,d.version));return id;}
  const id=await incoming();let d=await read('receiver',id);
  assert.equal(d.files.filter(f=>f.kind==='incoming').length,1);assert.equal(d.files.filter(f=>f.kind==='attachment').length,1);
  await assert.rejects(run('reader',()=>rpc('directive',id,d.version,{reason:'No autorizado'})),/FORBIDDEN/);
  await assert.rejects(run('writer',()=>rpc('attention',id,d.version,{reason:'No asignado todavía'})),/FORBIDDEN/);
  await assert.rejects(run('receiver',()=>rpc('assign',id,d.version,{assigned_to:ids.writer,reason:' ' })),/REASON_REQUIRED/);
  await assert.rejects(run('receiver',()=>rpc('assign',id,d.version,{assigned_to:ids.writer,due_date:'2000-01-01',reason:'Plazo inválido'})),/INVALID_DATE/);
  await run('receiver',()=>rpc('assign',id,d.version,{assigned_to:ids.writer,due_date:day(),requires_response:true,reason:'Preparar antecedentes técnicos'}));
  let a=await read('writer',id);assert.equal(a.assigned_name,'writer');assert.equal(a.followup.find(e=>e.action==='assign').target_name,'writer');
  await assert.rejects(run('receiver',()=>rpc('directive',id,d.version,{reason:'Versión antigua'})),/STALE_VERSION/);
  await run('receiver',()=>rpc('directive',id,a.version,{assigned_to:ids.writer,due_date:day(),requires_response:true,reason:'Revisar y elaborar una respuesta'}));
  a=await read('writer',id);const evidence=a.files.find(f=>f.kind==='attachment');
  const other=await incoming();const unrelated=(await read('receiver',other)).files[0];
  await assert.rejects(run('writer',()=>rpc('attention',id,a.version,{reason:'Evidencia de otro oficio',evidence_file_id:unrelated.id})),/INVALID_EVIDENCE/);
  await run('writer',()=>rpc('attention',id,a.version,{reason:'Antecedentes revisados y listos',evidence_file_id:evidence.id}));
  a=await read('writer',id);assert.equal(a.followup.find(e=>e.action==='attention').evidence_file_id,evidence.id);
  await assert.rejects(run('writer',()=>rpc('reply',id,a.version),'aal1'),/FORBIDDEN/);
  const reply=await run('writer',()=>rpc('reply',id,a.version,{lang:'es'}));
  assert.equal(await run('writer',()=>rpc('reply',id,a.version,{lang:'es'})),reply);
  let r=await read('writer',reply);assert.equal(r.parent_id,id);assert.equal(r.status,'draft');assert.equal(r.sequence,null);assert.equal(r.subject,'Respuesta a: Solicitud de información');assert.match(r.body,/EXT-123/);assert.match(r.body,/Solicitud de información/);assert.equal(r.recipients[0].party.id,party.id);assert.equal(r.recipients[0].contact_id,party.contacts[0].id);assert.equal(r.recipients[0].kind,'to');
  a=await read('writer',id);assert.equal(a.followup.filter(e=>e.action==='reply_created').length,1);assert.equal(a.related[0].sent_at,null);assert.match(attentionStatus(a,'es'),/borrador/i);
  await assert.rejects(run('receiver',()=>rpc('save',reply,r.version,{...r,recipients:[{kind:'to',party_id:party.id}]})),/FORBIDDEN/);
  await run('writer',()=>rpc('save',reply,r.version,{...r,signer_id:ids.signer,recipients:[{kind:'to',party_id:party.id}]}));r=await read('writer',reply);await run('writer',()=>rpc('submit',reply,r.version));r=await read('signer',reply);await run('signer',()=>rpc('approve',reply,r.version));
  a=await read('writer',id);assert.equal(a.related[0].sent_at,null);assert.ok(a.followup.some(e=>e.action==='approve'));
  const signed=await upload('signer',reply,'signed');r=await read('signer',reply);await run('signer',()=>rpc('verify',reply,r.version,{file_id:signed.id,reason:'Verificación sintética de firma'}));
  a=await read('writer',id);assert.equal(a.related[0].sent_at,null);assert.doesNotMatch(attentionStatus(a,'es'),/envío registrado/i);
  const proof=await upload('receiver',reply,'proof');r=await read('receiver',reply);await run('receiver',()=>rpc('manual_sent',reply,r.version,{email:'qa@example.test',proof_file_id:proof.id,reason:'Constancia sintética de envío registrada'}));
  a=await read('writer',id);assert.ok(a.related[0].sent_at);assert.match(attentionStatus(a,'es'),/envío registrado/i);assert.ok(a.followup.some(e=>e.action==='manual_sent'));assert.equal(a.status,'assigned');
  const restricted=await incoming('restricted');d=await read('receiver',restricted);await run('receiver',()=>rpc('assign',restricted,d.version,{assigned_to:ids.writer,reason:'Revisión reservada requerida'}));d=await read('writer',restricted);const rr=await run('writer',()=>rpc('reply',restricted,d.version,{lang:'en'}));r=await read('writer',rr);assert.match(r.subject,/Reply to:/);
  await run('writer',()=>rpc('save',rr,r.version,{...r,classification:'ordinary',recipients:[{kind:'to',party_id:party.id}]}));assert.equal((await read('writer',rr)).classification,'restricted');
  await assert.rejects(read('reader',rr),/FORBIDDEN/);await assert.rejects(read('reader',restricted),/FORBIDDEN/);
  await assert.rejects(run('writer',()=>db.query("select glf_records_private.core_v030('bootstrap',null,null,'{}')")),/permission denied/);
  await db.query('update glf_profiles set active=false where id=$1',[ids.reader]);d=await read('receiver',id);await assert.rejects(run('receiver',()=>rpc('directive',id,d.version,{assigned_to:ids.reader,reason:'Usuario inactivo'})),/INVALID_ASSIGNEE/);
 }finally{await db.close();}
});

test('Main letter selection and reply template tolerate legacy and missing source metadata',()=>{
 assert.equal(latestMainFile({files:[{id:'a',kind:'incoming',created_at:'2026-01-01'},{id:'b',kind:'attachment',created_at:'2026-03-01'},{id:'c',kind:'incoming',created_at:'2026-02-01'}]}).id,'c');
 const d=replyTemplate({subject:'Consulta',recipients:[]},'es');assert.match(d.body,/Consulta/);assert.doesNotMatch(d.body,/undefined|null|Invalid Date/);
});
