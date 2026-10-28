import test from 'node:test';import assert from 'node:assert/strict';
import {invitationMessage,invitationDocuments,invitationPerson} from '../src/kyc-invitation.js';
import {documents} from '../src/kyc-model.js';
const row=(relation,person)=>({code:12,name:'DESTINATARIO FICTICIO',relation,allow_scan:false,answers:{person,country:'EC',id:'0000000001001',owners:[]}});
const invitation={url:'https://example.test/#kyc=FICTIONAL',expires_at:'2026-11-03T22:48:00Z'};
test('Staff and board receive identity and CV, never commercial or corporate attachments',()=>{
 for(const relation of ['staff','board'])for(const lang of ['es','en']){
  const r=row(relation,'legal'),list=invitationDocuments(r,lang);
  assert.deepEqual(list.map(d=>d.key),['identity','cv']);
  const message=invitationMessage(r,invitation,lang);assert.ok(message.includes('CV'));assert.ok(!/Certificado bancario|Bank certificate|shareholders|accionistas|nombramiento/i.test(message));
 }
});
test('Natural RUC is not a company; national and foreign supplier/consultant requirements match form',()=>{
 for(const relation of ['supplier','consultant'])for(const country of ['EC','US']){
  const r=row(relation,'natural');r.answers.country=country;r.answers.idType=country==='EC'?'ruc':'passport';
  assert.equal(invitationPerson(r),'natural');assert.deepEqual(invitationDocuments(r).map(d=>d.key),documents({...r.answers,relation}).filter(k=>k!=='signed'));
  assert.ok(!/accionistas|Nombramiento|persona jurídica/.test(invitationMessage(r,invitation)));
 }
});
test('Company instructions include appointment and conditional 10% ownership, without exposing owners or financial answers',()=>{
 const r=row('consultant','legal');r.answers.owners=[{name:'PRIVATE OWNER',id:'PRIVATE ID',pct:'10',country:'US',idType:'passport'}];r.answers.bankAccount='PRIVATE ACCOUNT';r.answers.monthlyIncome='PRIVATE INCOME';
 const message=invitationMessage(r,invitation);assert.match(message,/Nombramiento o acreditación/);assert.match(message,/representante legal/);assert.match(message,/10 % o más/);
 for(const secret of ['PRIVATE OWNER','PRIVATE ID','PRIVATE ACCOUNT','PRIVATE INCOME'])assert.ok(!message.includes(secret));
 assert.deepEqual(invitationDocuments(r).map(d=>d.key),['identity','tax','bank','address_doc','appointment','owners']);
});
test('Minimal new cases do not mistake default natural for confirmation; linked suppliers can resolve classification',()=>{
 const r={...row('supplier','natural'),answers:{person:'natural',country:'EC',id:''}};
 assert.equal(invitationPerson(r),null);assert.ok(invitationDocuments(r).find(d=>d.key==='appointment').text.startsWith('Si es persona jurídica:'));
 r.supplier_id='supplier-1';const supplier={id:'supplier-1',person_type:'natural'};assert.equal(invitationPerson(r,supplier),'natural');assert.ok(!invitationDocuments(r,'es',supplier).some(d=>d.key==='appointment'));
 assert.equal(invitationPerson(r,{id:'other',person_type:'legal'}),null);
});
test('Invitation uses agreed confidentiality, Galapagos expiry, workflow and scan exception in both languages',()=>{
 const r=row('supplier','natural'),es=invitationMessage(r,invitation),en=invitationMessage(r,invitation,'en');
 assert.ok(es.startsWith('Asunto: GLF'));assert.match(es,/se tratarán en forma confidencial/);assert.match(es,/El acceso al enlace para consignar la información estará disponible hasta el 3 de noviembre de 2026/);assert.match(es,/4:48/);assert.match(es,/hora de Galápagos/);assert.doesNotMatch(es,/PILOTO|datos ficticios/);assert.match(es,/Pulse «Enviar»/);assert.match(es,/confirmación de guardado/);assert.ok(es.includes(invitation.url));assert.ok(!es.includes('&#x20;'));assert.ok(!es.includes('firma física'));
 assert.match(en,/3 November 2026/);assert.match(en,/4:48/);assert.match(en,/Galápagos time/);assert.doesNotMatch(en,/PILOT|fictional data/);assert.match(en,/treated confidentially/);
 r.allow_scan=true;assert.match(invitationMessage(r,invitation),/firma física/);assert.match(invitationMessage(r,invitation,'en'),/handwritten signature/);
 assert.throws(()=>invitationMessage(r,{...invitation,expires_at:'invalid'}),/INVALID_INVITATION/);
});

