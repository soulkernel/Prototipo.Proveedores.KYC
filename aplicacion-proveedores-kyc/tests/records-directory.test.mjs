import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {database,ids,as,call} from './records-fixture.mjs';
import {day} from '../src/records-model.js';
import {directoryWorkbook} from '../src/records-directory-export.js';
import ExcelJS from 'exceljs';
test('Directory changes preserve issued recipients, bind drafts, audit changes and export beyond a page',async()=>{
 const db=await database({through:'202611210032'});try{
  for(const name of ['admin','reader'])await db.query('insert into glf_profiles(id,display_name,manage_users) values($1,$2,$3)',[ids[name],name,name==='admin']);
  const rpc=(a,id=null,v=null,d={})=>as(db,ids.admin,()=>call(db,a,id,v,d));const boot=await rpc('bootstrap');
  await rpc('member',null,null,{user_id:ids.admin,unit_id:boot.units[0].id,site_id:boot.sites[0].id,initials:'QA',job_title:'Responsable de prueba',roles:[],reason:'Configuración sintética'});
  let p=await rpc('party',null,null,{kind:'institution',name:'Consejo sintético',address:'Dirección inicial',contact:{name:'Autoridad anterior',job_title:'Presidente',email:'old@example.test',is_representative:true}});const old=p.contacts[0].id;
  const base={direction:'outgoing',subject:'Respuesta histórica',body:'Respuesta de prueba con contenido suficiente.',document_date:day(),signer_id:ids.admin,classification:'ordinary',recipients:[{kind:'to',party_id:p.id,contact_id:old}]};
  const out=await rpc('save',null,null,base);let d=await rpc('read',out);await rpc('submit',out,d.version);d=await rpc('read',out);await rpc('approve',out,d.version);
  const draft=await rpc('save',null,null,{...base,subject:'Borrador pendiente',recipients:[{kind:'to',party_id:p.id}]});
  const incoming=(await db.query("insert into glf_records_private.documents(direction,subject,status,author_id,unit_id,site_id,received_at) values('incoming','Entrada histórica','received',$1,$2,$3,now()) returning id",[ids.admin,boot.units[0].id,boot.sites[0].id])).rows[0].id;
  await db.query("insert into glf_records_private.recipients(document_id,party_id,contact_id,kind) values($1,$2,$3,'from')",[incoming,p.id,old]);
  await db.exec(await fs.readFile(new URL('../supabase/migrations/202611210033_records_directory.sql',import.meta.url),'utf8'));
  assert.equal((await rpc('read',draft)).recipients[0].contact_id,old);
  await assert.rejects(as(db,ids.reader,()=>call(db,'authority_change',p.id,p.version,{name:'Intruso'})),/FORBIDDEN/);
  await assert.rejects(as(db,ids.admin,()=>call(db,'parties_export'), 'aal1'),/FORBIDDEN/);
  p=await rpc('authority_change',p.id,p.version,{name:'Nueva autoridad',job_title:'Presidenta',email:'new@example.test',phone:'001234',valid_from:day()});
  assert.equal(p.contacts.find(c=>c.id===old).active,false);const next=p.contacts.find(c=>c.active&&c.is_representative);assert.equal(next.name,'Nueva autoridad');
  assert.equal((await rpc('read',out)).recipients[0].contact.name,'Autoridad anterior');assert.equal((await rpc('read',incoming)).recipients[0].contact.name,'Autoridad anterior');assert.equal((await rpc('read',draft)).recipients[0].contact_id,old);
  p=await rpc('directory_update',p.id,p.version,{name:'Consejo actualizado',address:'Nueva dirección'});
  assert.equal((await rpc('read',incoming)).recipients[0].party.name,'Consejo sintético');assert.equal((await rpc('read',out)).recipients[0].party.name,'Consejo sintético');
  await assert.rejects(rpc('contact_update',p.id,p.version-1,{contact_id:next.id,name:'No guardar'}),/STALE_VERSION/);
  p=await rpc('contact_update',p.id,p.version,{contact_id:next.id,name:'Nueva autoridad corregida',job_title:'Presidenta',email:'updated@example.test',phone:'00999'});
  assert.equal(p.contacts.filter(c=>c.active&&c.is_representative).length,1);
  p=await rpc('contact_add',p.id,p.version,{name:'Secretaría',job_title:'Asistente',email:'secretary@example.test'});
  assert.equal(p.contacts.find(c=>c.name==='Secretaría').is_representative,false);
  assert.equal((await rpc('directory_read',p.id)).history.length,4);
  const fresh=await rpc('save',null,null,{...base,recipients:[{kind:'to',party_id:p.id}]});assert.equal((await rpc('read',fresh)).recipients[0].contact_id,next.id);
  // Issuing after migration must also freeze directory details.
  d=await rpc('read',fresh);await rpc('submit',fresh,d.version);d=await rpc('read',fresh);await rpc('approve',fresh,d.version);
  p=await rpc('contact_update',p.id,p.version,{contact_id:next.id,name:'Cambio posterior',job_title:'Presidenta'});
  assert.equal((await rpc('read',fresh)).recipients[0].contact.name,'Nueva autoridad corregida');
  for(let i=0;i<51;i++)await rpc('party',null,null,{kind:'institution',name:'Entidad '+String(i).padStart(3,'0')});
  assert.equal((await rpc('parties')).length,50);assert.equal((await rpc('parties_export')).length,52);assert.equal((await rpc('parties_export',null,null,{q:'secretary@example.test'})).length,1);
  assert.equal((await as(db,ids.reader,()=>call(db,'parties_export'))).length,52);
  await assert.rejects(as(db,ids.admin,()=>db.query("select glf_records_private.core_v032('bootstrap',null,null,'{}')")),/permission denied/);
  await assert.rejects(as(db,ids.reader,()=>db.query('select * from glf_records_private.directory_events')),/permission denied/);
 }finally{await db.close();}
});
test('Workbook contains every institution, current and former contacts, plain strings and filters',async()=>{
 const parties=Array.from({length:57},(_,i)=>({name:'Entidad '+i,kind:'institution',address:'Dirección',contacts:i?[{id:String(i),name:'Nombre '+i,email:'qa@example.test',phone:'001234',active:true}]:[{id:'a',name:'=1+1',job_title:'Presidente',phone:'0009',active:false,is_representative:true,valid_to:'2026-11-21'},{id:'b',name:'Vigente',active:true,is_representative:true}]}));
 const result=await directoryWorkbook(parties,'es','Entidad');const book=new ExcelJS.Workbook();await book.xlsx.load(result.buffer);
 assert.deepEqual(book.worksheets.map(s=>s.name),['Instituciones','Contactos']);assert.equal(book.worksheets[0].rowCount,61);assert.equal(book.worksheets[1].rowCount,62);assert.equal(book.worksheets[1].getCell('B5').value,'=1+1');assert.equal(book.worksheets[1].getCell('B5').type,ExcelJS.ValueType.String);assert.equal(book.worksheets[1].getCell('E5').value,'0009');assert.equal(book.worksheets[1].getCell('G5').value,'Anterior');assert.equal(book.worksheets[0].getCell('D5').value,'Vigente');assert.match(book.worksheets[0].getCell('A2').value,/Entidad/);
});

test('Supplier commercial contact is reused and legacy empty placeholders are excluded',async()=>{
 const result=await directoryWorkbook([{name:'Supplier',kind:'institution',supplier_id:'linked',contact_name:'Commercial person',email:'sales@example.test',phone:'00123',contacts:[{name:'',job_title:'',email:'',phone:'',is_representative:true}]}],'en');
 const book=new ExcelJS.Workbook();await book.xlsx.load(result.buffer);assert.equal(book.getWorksheet('Contacts').rowCount,5);assert.equal(book.getWorksheet('Contacts').getCell('B5').value,'Commercial person');assert.equal(book.getWorksheet('Contacts').getCell('F5').value,'Commercial contact');
});

test('Export groups separate supplier counterparts from independent institutions and individuals',async()=>{
 const fixtures=[
  {id:'s',supplier_id:'supplier-1',kind:'natural',name:'Proveedor natural',contact_name:'Contacto comercial',email:'s@example.test',contacts:[]},
  {id:'i',kind:'institution',name:'Institución administrativa',contacts:[{id:'a',name:'Presidenta',is_representative:true,active:true}]},
  {id:'n',kind:'natural',name:'Contraparte particular',contacts:[{id:'b',name:'Persona particular',phone:'00099',active:true}]}
 ];
 const expected={all:3,suppliers:1,institutions:1,individuals:1};
 for(const [group,count] of Object.entries(expected)){
  const result=await directoryWorkbook([...fixtures,fixtures[0]],'es','consulta',new Date(),{group});
  const book=new ExcelJS.Workbook();await book.xlsx.load(result.buffer);
  assert.equal(book.getWorksheet('Instituciones').rowCount,4+count);
  assert.equal(book.getWorksheet('Contactos').rowCount,4+count);
  assert.match(book.worksheets[0].getCell('A2').value,/consulta/);
  if(group==='institutions')assert.equal(book.worksheets[0].getCell('A5').value,'Institución administrativa');
  if(group==='individuals')assert.equal(book.worksheets[0].getCell('A5').value,'Contraparte particular');
 }
 const result=await directoryWorkbook([...fixtures,fixtures[0]],'en','',new Date(),{group:'contacts'});
 const book=new ExcelJS.Workbook();await book.xlsx.load(result.buffer);
 assert.deepEqual(book.worksheets.map(s=>s.name),['Contacts']);assert.equal(book.worksheets[0].rowCount,7);
 assert.equal(book.worksheets[0].getCell('J5').value,'Suppliers');
 assert.equal(book.worksheets[0].getCell('J6').value,'Institutions and entities');
 assert.equal(book.worksheets[0].getCell('J7').value,'Individuals');
 assert.equal(book.worksheets[0].getCell('A6').value,'Institución administrativa');
 const empty=await directoryWorkbook([],'es','ausente',new Date(),{group:'suppliers'});
 const emptyBook=new ExcelJS.Workbook();await emptyBook.xlsx.load(empty.buffer);assert.equal(emptyBook.worksheets[0].rowCount,4);
});
