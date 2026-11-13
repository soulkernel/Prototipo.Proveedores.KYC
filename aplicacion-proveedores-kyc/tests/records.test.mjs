import test from 'node:test';import assert from 'node:assert/strict';import {database,ids,as,call} from './records-fixture.mjs';
import {code,day,dateTimeToISO,validateDocument,invitationMail} from '../src/records-model.js';
import {recordsPdf} from '../src/records-pdf.js';
test('Correspondence model: dates, codes, PDF pagination and mail',()=>{
 assert.equal(code('PROY','SC','GA'),'PROY-SC-GA');assert.equal(dateTimeToISO('2026-11-13T09:30'),'2026-11-13T15:30:00.000Z');
 const row={direction:'outgoing',subject:'Carta de prueba',document_date:'2026-02-30',body:'Texto formal de prueba',recipients:[{party:{id:'qa',name:'Entidad ficticia',email:'qa@example.test'},kind:'to'}]};
 assert.ok(validateDocument(row).includes('document_date'));row.document_date=day();assert.deepEqual(validateDocument(row),[]);
 const pdf=recordsPdf({...row,body:'Texto de prueba con párrafos.\n'.repeat(160),signer_name:'Nombre de prueba',job_title:'Cargo',origin_code:'PROY-SC-GA',sequence:1,year:2026});assert.ok(pdf.pages>2);assert.ok(pdf.buffer.byteLength>1000);assert.equal(invitationMail(row).to,'qa@example.test');
});
test('Relational correspondence: workflow, server permissions, atomic numbering, file isolation and history',async t=>{
 const db=await database();try{
  for(const [name,id] of Object.entries(ids))await db.query('insert into glf_profiles(id,display_name,manage_users) values($1,$2,$3)',[id,name,name==='admin']);
  const run=(name,fn,aal)=>as(db,ids[name],fn,aal),rpc=(a,id,v,d)=>call(db,a,id,v,d);
  let boot=await run('admin',()=>rpc('bootstrap')),ad=await run('admin',()=>rpc('admin'));
  const unit=boot.units.find(u=>u.code==='PROY').id,site=boot.sites.find(s=>s.code==='SX').id;
  const roleIds=names=>ad.roles.filter(r=>names.includes(r.name)).map(r=>r.id);
  for(const [name,roleNames] of [['admin',[]],['writer',['Redacción']],['signer',['Firma']],['receiver',['Recepción y archivo','Despacho']]])await run('admin',()=>rpc('member',null,null,{user_id:ids[name],unit_id:unit,site_id:site,initials:name.slice(0,2).toUpperCase(),job_title:'Cargo de prueba',roles:roleIds(roleNames),reason:'Configuración sintética'}));
  let party,doc,restricted;
  await t.test('Anonymous and weak MFA cannot enter; reader cannot assign roles or create institutions',async()=>{
   await assert.rejects(as(db,null,()=>rpc('bootstrap')),/permission denied/);await assert.rejects(run('writer',()=>rpc('bootstrap'),'aal1'),/FORBIDDEN/);
   await assert.rejects(run('reader',()=>rpc('admin')),/FORBIDDEN/);await assert.rejects(run('reader',()=>rpc('party',null,null,{name:'No permitido',kind:'institution'})),/FORBIDDEN/);
   await assert.rejects(run('admin',()=>db.query('select * from glf_records_private.documents')),/permission denied/);
  });
  await t.test('Supplier identity is linked once, live commercial edits remain visible',async()=>{
   const sid=(await db.query("insert into glf_suppliers(scope,person_type,country_code,country_name,id_country_code,id_type,id_number,legal_name,offer_type,city,email,phone,created_by,updated_by) values('glf','natural','EC','Ecuador','EC','cedula','0000077777','FICTICIO','services','Quito','qa@example.test','0000000000',$1,$1) returning id",[ids.writer])).rows[0].id;
   const p1=await run('writer',()=>rpc('party',null,null,{supplier_id:sid})),p2=await run('writer',()=>rpc('party',null,null,{supplier_id:sid}));assert.equal(p1.id,p2.id);
   assert.equal((await db.query('select name from glf_records_private.parties where id=$1',[p1.id])).rows[0].name,null);
   await db.query("update glf_suppliers set legal_name='FICTICIO corregido' where id=$1",[sid]);assert.equal((await run('reader',()=>rpc('parties')))[0].name,'FICTICIO corregido');
  });
  party=await run('writer',()=>rpc('party',null,null,{kind:'institution',name:'Institución de prueba',address:'Dirección de prueba',contact:{name:'Autoridad',email:'autoridad@example.test',is_representative:true}}));
  const base={direction:'outgoing',subject:'Oficio de prueba',body:'Solicito información para prueba del módulo.',place:'Santa Cruz',document_date:day(),classification:'ordinary',signer_id:ids.signer,recipients:[{kind:'to',party_id:party.id,contact_id:party.contacts[0].id}]};
  doc=await run('writer',()=>rpc('save',null,null,base));restricted=await run('writer',()=>rpc('save',null,null,{...base,classification:'restricted',subject:'Reservado'}));
  await t.test('General read does not expose restricted metadata, revisions or files, even to an administrator',async()=>{
   const list=await run('reader',()=>rpc('list'));assert.equal(list.rows.length,1);await assert.rejects(run('reader',()=>rpc('read',restricted)),/FORBIDDEN/);await assert.rejects(run('admin',()=>rpc('read',restricted)),/FORBIDDEN/);
   await assert.rejects(run('writer',()=>rpc('save',null,null,{...base,direction:'incoming',received_at:new Date().toISOString()})),/FORBIDDEN/);
  });
  await t.test('Field, identity and optimistic concurrency validation',async()=>{
   await assert.rejects(run('writer',()=>rpc('save',doc,99,base)),/STALE_VERSION/);
   await assert.rejects(run('writer',()=>rpc('save',null,null,{...base,document_date:'2099-12-31'})),/INVALID_DATE/);
   await assert.rejects(run('writer',()=>rpc('save',null,null,{...base,signer_id:ids.reader})),/INVALID_SIGNER/);
   const other=await run('writer',()=>rpc('party',null,null,{kind:'natural',name:'Otra persona'}));
   await assert.rejects(run('writer',()=>rpc('save',null,null,{...base,recipients:[{kind:'to',party_id:other.id,contact_id:party.contacts[0].id}]})),/INVALID_CONTACT/);
  });
  await run('writer',()=>rpc('submit',doc,1));await run('writer',()=>rpc('submit',restricted,1));
  await t.test('Only selected signer approves; numbering is shared and repeated clicks cannot consume twice',async()=>{
   await assert.rejects(run('writer',()=>rpc('approve',doc,2)),/FORBIDDEN/);
   await run('signer',()=>rpc('approve',doc,2));await assert.rejects(run('signer',()=>rpc('approve',doc,2)),/STALE_VERSION/);await run('signer',()=>rpc('approve',restricted,2));
   const a=await run('signer',()=>rpc('read',doc)),b=await run('signer',()=>rpc('read',restricted));assert.equal(a.sequence,1);assert.equal(b.sequence,2);assert.equal(a.revisions.length,1);
   await run('writer',()=>rpc('party',party.id,party.version,{name:'Institución renombrada',kind:'institution',address:'Nueva dirección'}));
   const c=await run('signer',()=>rpc('read',doc));assert.equal(c.revisions[0].snapshot.recipients[0].party.name,'Institución de prueba');assert.equal(c.recipients[0].party.name,'Institución renombrada');
  });
  await t.test('Private file tickets cannot overwrite, upload by readers, or mark missing objects complete',async()=>{
   await assert.rejects(run('reader',()=>rpc('upload',doc,3,{kind:'signed',filename:'a.pdf',mime:'application/pdf',size:20})),/FORBIDDEN/);
   const ticket=await run('signer',()=>rpc('upload',doc,3,{kind:'signed',filename:'firmado.pdf',mime:'application/pdf',size:20}));
   await assert.rejects(run('signer',()=>rpc('confirm_upload',doc,3,{file_id:ticket.id})),/FILE_MISSING/);
   await run('signer',()=>db.query("insert into storage.objects(bucket_id,name,metadata) values('glf-correspondence',$1,$2)",[ticket.path,JSON.stringify({size:20})]));
   await run('signer',()=>rpc('confirm_upload',doc,3,{file_id:ticket.id}));
   assert.equal((await run('signer',()=>db.query("update storage.objects set metadata='{}' where name=$1 returning *",[ticket.path]))).rows.length,0);
   await run('signer',()=>rpc('verify',doc,4,{file_id:ticket.id,reason:'Firma y contenido comprobados en herramienta externa.'}));
   assert.equal((await run('signer',()=>rpc('read',doc))).status,'signed');
   const privateTicket=await run('signer',()=>rpc('upload',restricted,3,{kind:'signed',filename:'reservado.pdf',mime:'application/pdf',size:20}));
   await db.query("insert into storage.objects(bucket_id,name,metadata) values('glf-correspondence',$1,$2)",[privateTicket.path,JSON.stringify({size:20})]);await run('signer',()=>rpc('confirm_upload',restricted,3,{file_id:privateTicket.id}));
   assert.equal((await run('reader',()=>db.query("select * from storage.objects where name=$1",[privateTicket.path]))).rows.length,0);
  });
  await t.test('Manual dispatch needs proof; download is not dispatch',async()=>{
   await assert.rejects(run('receiver',()=>rpc('manual_sent',doc,5,{email:'qa@example.test',reason:'Enviado de forma manual'})),/FILE_MISSING/);
   const ticket=await run('receiver',()=>rpc('upload',doc,5,{kind:'proof',filename:'constancia.pdf',mime:'application/pdf',size:20}));
   await db.query("insert into storage.objects(bucket_id,name,metadata) values('glf-correspondence',$1,$2)",[ticket.path,JSON.stringify({size:20})]);await run('receiver',()=>rpc('confirm_upload',doc,5,{file_id:ticket.id}));
   await run('receiver',()=>rpc('manual_sent',doc,6,{email:'qa@example.test',proof_file_id:ticket.id,reason:'Enviado desde buzón institucional; se adjunta constancia.'}));
   assert.equal((await run('reader',()=>rpc('read',doc))).status,'sent');
  });
  await t.test('A changed author profile requires return and explicit review before numbering',async()=>{
   const fresh=await run('writer',()=>rpc('save',null,null,base));await run('writer',()=>rpc('submit',fresh,1));
   await db.query('update glf_records_private.members set version=version+1 where user_id=$1',[ids.writer]);
   await assert.rejects(run('signer',()=>rpc('approve',fresh,2)),/ORIGIN_CHANGED/);
   await run('signer',()=>rpc('return',fresh,2,{reason:'Revisar origen actualizado'}));await run('writer',()=>rpc('save',fresh,3,base));await run('writer',()=>rpc('submit',fresh,4));await run('signer',()=>rpc('approve',fresh,5));
   assert.equal((await run('writer',()=>rpc('read',fresh))).sequence,3);
  });
  await t.test('Reception remains explicit; assignment and closing require the proper capabilities',async()=>{
   const incoming=await run('receiver',()=>rpc('save',null,null,{...base,direction:'incoming',signer_id:null,received_at:new Date().toISOString(),recipients:[{kind:'from',party_id:party.id}]}));
   await assert.rejects(run('writer',()=>rpc('assign',incoming,1,{assigned_to:ids.writer})),/FORBIDDEN/);
   await run('receiver',()=>rpc('assign',incoming,1,{assigned_to:ids.writer,requires_response:true,due_date:day(),reason:'Atender solicitud'}));
   await assert.rejects(run('writer',()=>rpc('close',incoming,2,{reason:'Respondido'})),/FORBIDDEN/);
   await run('receiver',()=>rpc('close',incoming,2,{reason:'Respuesta completa documentada'}));
  });
 }finally{await db.close();}
});
