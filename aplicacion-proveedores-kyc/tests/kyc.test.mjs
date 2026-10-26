const dateOnly=v=>v instanceof Date?v.toISOString().slice(0,10):v;
import {dayAt,addMonths} from '../src/kyc-lifecycle.js';
import {searchDemoCases} from '../src/kyc-search.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import {fields,project,validate,documents,entries} from '../src/kyc-model.js';
const sample=(relation='staff',person='natural')=>project({relation,person,nationalityType:'national',country:'EC',residenceCountry:'EC',id:person==='legal'&&!['staff','board'].includes(relation)?'0000000001001':'0000000001',name:'PERSONA FICTICIA QA',birthDate:'1990-01-01',incorporationDate:'2000-01-01',nationality:'Ecuatoriana',email:'qa@example.test',phone:'0000000000',city:'Quito',address:'Dirección ficticia',role:'Prueba',spouse:'no',pepSelf:'no',pepFamily:'no',glfFamily:'no',truth:'yes',invoice:'yes',taxId:'0000000001001',activity:'Pruebas',services:'Pruebas',monthlyIncome:'0',monthlyExpenses:'0',bankName:'BANCO FICTICIO',bankHolder:'FICTICIO',bankAccount:'000',legalRep:'FICTICIO',legalRepId:'0000000002',legalRepCountry:'EC',ownershipExplanation:'Fundación sin socios',funds:'Actividad ficticia',owners:[]});
test('One model controls all routes, hidden answers, owners threshold, documents and PDF entries',()=>{
 for(const relation of ['staff','board','supplier','consultant'])for(const person of ['natural','legal'])assert.deepEqual(validate(sample(relation,person)),[]);
 const staff=project({...sample(),person:'legal',bankAccount:'hidden',legalRep:'hidden',owners:[{name:'hidden',pct:'10'}],pepName:'hidden'});assert.equal(staff.person,'natural');for(const k of ['bankAccount','legalRep','pepName'])assert.equal(staff[k],undefined);assert.deepEqual(documents(staff),['signed','identity','cv']);assert.ok(!JSON.stringify(entries(staff,'es')).includes('hidden'));
 const natural=sample('supplier');assert.equal(natural.person,'natural');assert.ok(documents(natural).includes('tax'));assert.ok(!documents(natural).includes('appointment'));assert.ok(documents(natural).includes('bank'));
 const legal=sample('consultant','legal');legal.owners=[{name:'QA',pct:'10',country:'EC',id:'0000000002'}];assert.deepEqual(validate(legal),[]);assert.ok(documents(legal).includes('owner_0'));legal.owners[0].pct='9.99';assert.ok(validate(legal).includes('owners'));
});
test('KYC database: private access, links, concurrency, attachments, human review and expiry',async t=>{
 const db=new PGlite();const manager='00000000-0000-4000-8000-000000000001',reader='00000000-0000-4000-8000-000000000002',assistant='00000000-0000-4000-8000-000000000003';const jwt={sub:manager,iss:'https://dcxhuwghakdjcnrqkziq.supabase.co/auth/v1',role:'authenticated',aud:'authenticated',aal:'aal2'};
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid(),auth.jwt() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text unique,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated,anon;`);
 for(const name of (await fs.readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort())await db.exec(await fs.readFile('supabase/migrations/'+name,'utf8'));
 for(const [id,name,role] of [[manager,'Responsable','manager'],[reader,'Consulta','none'],[assistant,'Asistente','none']])await db.query('insert into glf_profiles(id,display_name,kyc_role) values($1,$2,$3)',[id,name,role]);
 async function as(claims,fn){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims||{})]);await db.exec('set role '+(claims?'authenticated':'anon'));try{return await fn();}finally{await db.exec('reset role');}}
 const call=(name,args=[],casts=[])=>db.query('select glf_kyc_'+name+'('+args.map((_,i)=>'$'+(i+1)+(casts[i]?'::'+casts[i]:'')).join(',')+') result',args).then(r=>r.rows[0].result);
 let id,token,row;
 await t.test('Explicit manager creates; directory reader and weak MFA cannot access',async()=>{id=await as(jwt,()=>call('create',[null,'FICTICIO','qa@example.test','staff']));await as({...jwt,sub:reader},async()=>{assert.equal((await db.query('select * from glf_kyc_cases')).rows.length,0);await assert.rejects(call('create',[null,'FICTICIO','qa@example.test','staff']),/FORBIDDEN/);});await as({...jwt,aal:'aal1'},()=>assert.rejects(call('invite',[id,false]),/FORBIDDEN/));await as({...jwt,iss:'https://wrong'},()=>assert.rejects(call('invite',[id,false]),/FORBIDDEN/));});
 await t.test('Private tables and token hashes have no anonymous access',async()=>{await as(null,()=>assert.rejects(db.query('select * from glf_kyc_cases'),/permission denied/));await as(jwt,()=>assert.rejects(db.query('select * from glf_kyc_private.invitations'),/permission denied/));const x=await as(jwt,()=>call('invite',[id,false]));token=x.token;assert.equal(token.length,64);assert.equal((await db.query('select octet_length(token_hash) n from glf_kyc_private.invitations')).rows[0].n,32);await as(null,()=>assert.rejects(call('read',['a'.repeat(64)]),/LINK_INVALID/));});
 await t.test('Server and browser rules agree for all form routes',async()=>{for(const relation of ['staff','board','supplier','consultant'])for(const person of ['natural','legal']){const a=sample(relation,person);assert.deepEqual((await db.query('select glf_kyc_private.validate($1::jsonb) errors',[JSON.stringify(a)])).rows[0].errors,validate(a));assert.deepEqual((await db.query('select glf_kyc_private.documents($1::jsonb) docs',[JSON.stringify(a)])).rows[0].docs,documents(a));}});
 await t.test('Save sanitizes hidden values, rejects route tampering and stale writes',async()=>{row=await as(null,()=>call('read',[token]));await as(null,()=>assert.rejects(call('save',[token,1,JSON.stringify(sample('supplier'))],['text','integer','jsonb']),/ROUTE_MISMATCH/));const a={...sample(),bankAccount:'NEVER_STORE',owners:[{name:'NEVER_STORE'}]};assert.equal(await as(null,()=>call('save',[token,1,JSON.stringify(a)],['text','integer','jsonb'])),2);row=await as(null,()=>call('read',[token]));assert.equal(row.answers.bankAccount,undefined);await as(null,()=>assert.rejects(call('save',[token,1,JSON.stringify(sample())],['text','integer','jsonb']),/STALE_VERSION/));});
 await t.test('PDF requires complete answers, document upload requires case ticket',async()=>{await as(null,()=>call('prepare_pdf',[token,2]));await as(null,()=>assert.rejects(call('submit',[token,2]),/MISSING_DOCUMENT/));await as(null,()=>assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('glf-kyc-documents','guessed')"),/row-level security/));await as(null,()=>assert.rejects(call('upload_ticket',[token,id,2,'report']),/INVALID_SLOT/));});
 async function upload(slot,external=true){const path=await as(external?null:jwt,()=>call('upload_ticket',[external?token:null,id,row.version,slot]));await as(external?null:jwt,()=>db.query("insert into storage.objects(bucket_id,name,metadata) values('glf-kyc-documents',$1,$2)",[path,{size:1024,mimetype:'application/pdf'}]));await as(external?null:jwt,()=>call('attach',[external?token:null,path,'FICTICIO.pdf']));return path;}
 await t.test('Attachments isolated from ordinary users; submission closes link and freezes snapshot',async()=>{for(const slot of documents(row.answers))await upload(slot);await as(jwt,async()=>assert.equal((await db.query("select * from storage.objects where bucket_id='glf-kyc-documents'")).rows.length,3,'Compliance can download all referenced files'));await as({...jwt,sub:reader},async()=>{assert.equal((await db.query('select * from glf_kyc_files')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);});await as(null,async()=>assert.equal((await db.query('select * from storage.objects')).rows.length,0));const r=await as(null,()=>call('submit',[token,2]));assert.equal(r.version,2);await as(null,()=>assert.rejects(call('read',[token]),/LINK_INVALID/));await as(null,()=>assert.rejects(call('submit',[token,2]),/LINK_INVALID/));assert.equal((await db.query('select * from glf_kyc_private.submissions')).rows.length,1);});
 await t.test('Final review requires human confirmation, selected report, risk, date and countersignature',async()=>{
 const opts={risk:'high',issued:dayAt(new Date()),expected:1};
 await as(jwt,()=>assert.rejects(call('review',[id,'approved','Prueba humana',true]),/FINAL_REVIEW_REQUIRED/));
 await as(jwt,()=>assert.rejects(call('finish',[id,'approved','Prueba humana',true,opts]),/REPORT_REQUIRED/));
 const reportPath=await upload('report',false);opts.report=(await db.query('select id from glf_kyc_files where path=$1',[reportPath])).rows[0].id;
 await as(jwt,()=>assert.rejects(call('finish',[id,'approved','Prueba humana',false,opts]),/INVALID_REVIEW/));
 await as(jwt,()=>assert.rejects(call('finish',[id,'approved','Prueba humana',true,{...opts,risk:''}]),/RISK_REQUIRED/));
 await as(jwt,()=>assert.rejects(call('finish',[id,'approved','Prueba humana',true,opts]),/COUNTERSIGN_REQUIRED/));
 await upload('countersigned',false);await as(jwt,()=>assert.rejects(call('finish',[id,'approved','Prueba humana',true,opts]),/SCREENING_REVIEW_REQUIRED/));
 await as(jwt,()=>call('screening',[id,1,row.version,'clear','Evidencias ficticias revisadas',opts.report,true]));opts.expected=2;await as(jwt,()=>call('finish',[id,'approved','Prueba humana',true,opts]));
 const closed=(await db.query('select * from glf_kyc_cases where id=$1',[id])).rows[0];assert.equal(dateOnly(closed.review_due_on),addMonths(opts.issued,12));assert.equal(closed.final_report_id,opts.report);
 await as(jwt,()=>assert.rejects(call('invite',[id,false]),/INVALID_STATE/));
 });
 await t.test('Renewal invalidates prior link; expiry retains draft and prevents editing',async()=>{id=await as(jwt,()=>call('create',[null,'NUEVO','qa@example.test','board']));const old=(await as(jwt,()=>call('invite',[id,false]))).token;token=(await as(jwt,()=>call('invite',[id,false]))).token;await as(null,()=>assert.rejects(call('read',[old]),/LINK_INVALID/));await db.query("update glf_kyc_private.invitations set expires_at=now()-interval '1 minute' where case_id=$1",[id]);await as(null,()=>assert.rejects(call('read',[token]),/LINK_INVALID/));assert.equal((await db.query('select answers from glf_kyc_cases where id=$1',[id])).rows.length,1);});
 await t.test('Delegation is time-limited, cannot self-escalate, and revocation is immediate',async()=>{const until=new Date(Date.now()+86400000).toISOString();await as(jwt,()=>call('delegate',[assistant,until,'Vacaciones prueba']));await as({...jwt,sub:assistant},async()=>{assert.equal(await call('allowed'),true);await assert.rejects(call('delegate',[reader,until,'Escalar prueba']),/FORBIDDEN/);});await as(jwt,()=>call('delegate',[assistant,null,'Fin de delegación']));await as({...jwt,sub:assistant},async()=>assert.equal(await call('allowed'),false));assert.equal((await db.query('select * from glf_kyc_delegation_audit')).rows.length,2);});
 await t.test('Search covers old cases, identity variants, linked supplier, pages and private access',async()=>{
 const supplier=(await db.query("insert into glf_suppliers(scope,person_type,country_code,country_name,id_country_code,id_type,id_number,tax_number,legal_name,offer_type,city,email,phone,created_by,updated_by) values('government','natural','EC','Ecuador','EC','cedula','0000000012','0000000012001','María José Pérez','services','Quito','qa@example.test','0000000000',$1,$1) returning id",[manager])).rows[0].id;
 const older=await as(jwt,()=>call('create',[supplier,'María José Pérez','qa@example.test','supplier']));
 await db.query("update glf_kyc_cases set answers=$2,updated_at='2020-01-01' where id=$1",[older,{name:'María José Pérez',idType:'passport',id:'QA-PASS-987',country:'US',bankAccount:'PRIVATE-DO-NOT-LIST'}]);
 await db.query("insert into glf_kyc_cases(name,email,relation,created_by) select 'Relleno '||n,'qa@example.test','staff',$1 from generate_series(1,205)n",[manager]);
 for(const q of ['perez maria','MARÍA JOSÉ','0000000012','0000000012001','QA PASS 987']){
 const result=await as(jwt,()=>call('search',[q,0]));assert.equal(result.total,1,q);assert.equal(result.items[0].id,older);assert.equal(result.items[0].answers,undefined);assert.ok(!JSON.stringify(result).includes('PRIVATE-DO-NOT-LIST'));
 }
 const first=await as(jwt,()=>call('search',['',0])),second=await as(jwt,()=>call('search',['',50]));assert.ok(first.total>200);assert.equal(first.items.length,50);assert.equal(second.items.length,50);assert.ok(second.items.every(r=>!first.items.some(f=>f.id===r.id)));
 assert.equal((await as(jwt,()=>call('search',['SIN COINCIDENCIA',0]))).total,0);
 assert.equal((await as(jwt,()=>call('search',['NUEVO',0]))).items[0].identifications.length,0);
 await as({...jwt,sub:reader},()=>assert.rejects(call('search',['',0]),/FORBIDDEN/));await as({...jwt,aal:'aal1'},()=>assert.rejects(call('search',['',0]),/FORBIDDEN/));await as(null,()=>assert.rejects(call('search',['',0]),/permission denied/));
 const raw=(await db.query('select * from glf_kyc_cases')).rows,commercial=(await db.query('select * from glf_suppliers')).rows;
 for(const q of ['perez maria','0000000012001','QA PASS 987','NUEVO','SIN COINCIDENCIA']){const live=await as(jwt,()=>call('search',[q,0]));assert.deepEqual(searchDemoCases(raw,commercial,q).items.map(c=>c.id).sort(),live.items.map(c=>c.id).sort());}
 });
 await t.test('Screening lifecycle: policy months, manual exceptions, unchanged baseline and history',async()=>{
 async function fixture(risk,state='approved',options={}){
 const cid=(await db.query("insert into glf_kyc_cases(name,email,relation,state,created_by) values($1,'cycle@example.test','staff','review',$2) returning id",['FICTICIO '+risk+Math.random(),manager])).rows[0].id;
 const report=(await db.query("insert into glf_kyc_files(case_id,slot,path,name,bytes,mime,version,created_at) values($1,'report',$2,'INFORME_FICTICIO.pdf',100,'application/pdf',1,'2024-02-29T12:00:00Z') returning id",[cid,cid+'/report'])).rows[0].id;
 await db.query("insert into glf_kyc_files(case_id,slot,path,name,bytes,mime,version) values($1,'countersigned',$2,'FICTICIO_SIN_FIRMA.pdf',100,'application/pdf',1)",[cid,cid+'/signed']);
 await db.query("update glf_kyc_cases set screening_status='clear',screening_answers_version=version,screening_file_id=$2,screening_recorded_at=now(),screening_by=$3 where id=$1",[cid,report,manager]);
 const opts={risk,report,issued:'2024-02-28',expected:1,...options};
 await as(jwt,()=>call('finish',[cid,state,'Resultado ficticio de prueba',true,opts]));return (await db.query('select * from glf_kyc_cases where id=$1',[cid])).rows[0];
 }
 for(const [risk,due] of [['high','2025-02-28'],['medium','2026-02-28'],['low','2027-02-28']]){const c=await fixture(risk);assert.equal(dateOnly(c.review_due_on),due);assert.equal(dateOnly(c.policy_due_on),due);assert.equal(dayAt(c.report_uploaded_at),'2024-02-29');assert.equal(dateOnly(c.report_issued_on),'2024-02-28');}
 const rejected=await fixture('high','not_approved');assert.equal(rejected.review_due_on,null);assert.equal((await as(jwt,()=>call('preflight',[null,rejected.id]))).status,'not_cleared');
 const c=await fixture('high','approved',{due:'2024-08-29',reason:'Adelantar por riesgo'});assert.equal(dateOnly(c.review_due_on),'2024-08-29');assert.equal(c.schedule_exception,false);
 await as(jwt,()=>assert.rejects(call('reschedule',[c.id,'2026-01-01','Extender plazo',false,2]),/POLICY_EXCEPTION_REQUIRED/));
 await as(jwt,()=>assert.rejects(call('reschedule',[c.id,'2024-08-01','',false,2]),/SCHEDULE_REASON_REQUIRED/));
 await as(jwt,()=>call('reschedule',[c.id,'2030-01-01','Excepción explícita de prueba',true,2]));
 await as(jwt,()=>assert.rejects(call('reschedule',[c.id,'2031-01-01','Otra prueba',true,2]),/STALE_VERSION/));
 let changed=(await db.query('select * from glf_kyc_cases where id=$1',[c.id])).rows[0];assert.equal(dateOnly(changed.policy_due_on),dateOnly(c.policy_due_on));assert.equal(+changed.report_uploaded_at,+c.report_uploaded_at);assert.equal(changed.schedule_exception,true);
 const ctx=await as(jwt,()=>call('preflight',[null,c.id]));assert.equal(ctx.status,'valid');
 await as(jwt,()=>assert.rejects(call('start',[null,c.id,c.name,c.email,'staff','']),/REVIEW_REASON_REQUIRED/));
 const next=await as(jwt,()=>call('start',[null,c.id,c.name,c.email,'staff','Revisión anticipada de prueba']));
 const repeat=await as(jwt,()=>call('start',[null,c.id,c.name,c.email,'staff','Reintento']));assert.equal(repeat.id,next.id);assert.equal(repeat.continued,true);
 const fresh=(await db.query('select * from glf_kyc_cases where id=$1',[next.id])).rows[0];assert.equal(fresh.subject_id,c.subject_id);assert.equal(fresh.previous_case_id,c.id);assert.equal(fresh.review_due_on,null);assert.equal(fresh.pdf_version,null);assert.notEqual(fresh.answers.truth,'yes');assert.equal((await db.query('select count(*) n from glf_kyc_files where case_id=$1',[next.id])).rows[0].n,0);
 const progress=await as(jwt,()=>call('preflight',[null,c.id]));assert.equal(progress.status,'in_progress');assert.equal(progress.history.length,2);
 await as(jwt,()=>assert.rejects(call('reschedule',[c.id,'2031-01-01','No modificar anterior',true,3]),/SUPERSEDED_REVIEW/));
 const expired=await fixture('high');assert.equal((await as(jwt,()=>call('preflight',[null,expired.id]))).status,'expired');await as(jwt,()=>call('start',[null,expired.id,expired.name,expired.email,'staff','']));
 await as(jwt,()=>assert.rejects(call('start',[null,rejected.id,rejected.name,rejected.email,'staff','']),/REVIEW_REASON_REQUIRED/));
 const ev=(await db.query("select detail from glf_kyc_events where case_id=$1 and action='review_rescheduled'",[c.id])).rows;assert.equal(ev.length,1);assert.equal(JSON.parse(ev[0].detail).previous_due,'2024-08-29');
 for(const [name,args] of [['preflight',[null,c.id]],['candidates',['FICTICIO',0]],['start',[null,null,'Nueva','n@example.test','staff','']],['reschedule',[c.id,'2032-01-01','Intento no autorizado',true,3]]])await as({...jwt,sub:reader},()=>assert.rejects(call(name,args),/FORBIDDEN/));
 await as(null,()=>assert.rejects(call('preflight',[null,c.id]),/permission denied/));
 const candidates=await as(jwt,()=>call('candidates',['0000000012001',0]));assert.equal(candidates.supplier_total,1);assert.ok(candidates.cases.total>=1);
 });
 await t.test('Approved form: natural RUC, tax annex, inbox counts and routes',async()=>{
 const a=project({...sample('consultant'),idType:'ruc',id:'0000000001001'});assert.equal(a.person,'natural');assert.equal(a.idType,'ruc');assert.equal(a.taxId,undefined);assert.deepEqual(validate(a),[]);assert.ok(documents(a).includes('tax'));assert.ok(!documents(a).includes('appointment'));
 const server=(await db.query('select glf_kyc_private.project($1) p,glf_kyc_private.validate($1) v,glf_kyc_private.documents($1) d',[a])).rows[0];assert.deepEqual(server.p,a);assert.deepEqual(server.v,[]);assert.deepEqual(server.d,documents(a));
 const x=await as(jwt,()=>call('start_route',[null,null,'Ruta internacional ficticia','ruta@example.test','consultant_international','']));const c=(await db.query('select * from glf_kyc_cases where id=$1',[x.id])).rows[0];assert.equal(c.relation,'consultant');assert.equal(c.answers.nationalityType,'international');assert.equal(c.form_version,'2026-10-25.2');
 const inv=await as(jwt,()=>call('invite',[x.id,false]));await db.query("update glf_kyc_cases set form_version='2026-10-25.1',pdf_version=version where id=$1",[x.id]);const adopted=await as(null,()=>call('save',[inv.token,c.version,c.answers]));const adoptedRow=(await db.query('select form_version,pdf_version,version from glf_kyc_cases where id=$1',[x.id])).rows[0];assert.equal(adoptedRow.form_version,'2026-10-25.2');assert.equal(adoptedRow.pdf_version,null);assert.equal(adopted,c.version+1);await db.query("update glf_kyc_private.invitations set expires_at=now()-interval '1 day' where case_id=$1",[x.id]);
 const filtered=await as(jwt,()=>call('inbox',['Ruta internacional',0,'expired_link']));assert.equal(filtered.total,1);assert.equal(filtered.counts.all,1);assert.equal(filtered.counts.expired_link,1);assert.ok(filtered.items[0].invitation_expires_at);assert.ok(!JSON.stringify(filtered).includes(inv.token));assert.equal((await as(jwt,()=>call('inbox',['Ruta internacional',0,'draft']))).total,0);
 const many=await as(jwt,()=>call('inbox',['Relleno',50,'draft']));assert.equal(many.total,205);assert.equal(many.items.length,50);assert.equal(many.counts.draft,205);
 await as({...jwt,sub:reader},()=>assert.rejects(call('inbox',['',0,'all']),/FORBIDDEN/));
 });
 await t.test('Institutional screening: evidence, authorization, concurrent edits, corrections and closed inbox',async()=>{
 const cid=await as(jwt,()=>call('create',[null,'SCREENING FICTICIO','screening@example.test','staff']));
 const get=async()=> (await db.query('select * from glf_kyc_cases where id=$1',[cid])).rows[0];
 const record=(status='clear',file=null,expected=1,version=1)=>call('screening',[cid,expected,version,status,'Verificación de evidencia ficticia',file,true]);
 await as(jwt,()=>assert.rejects(record(),/INVALID_STATE/));
 await db.query("update glf_kyc_cases set state='review',receipt_at=now(),answers=$2 where id=$1",[cid,sample()]);
 const report=(await db.query("insert into glf_kyc_files(case_id,slot,path,name,bytes,mime,version) values($1,'report',$2,'RESERVADO_SCREENING.pdf',100,'application/pdf',1) returning id",[cid,cid+'/screening'])).rows[0].id;
 await db.query("insert into glf_kyc_files(case_id,slot,path,name,bytes,mime,version) values($1,'countersigned',$2,'FICTICIO.pdf',100,'application/pdf',1)",[cid,cid+'/counter']);
 for(const claims of [{...jwt,sub:reader},{...jwt,aal:'aal1'},{...jwt,iss:'wrong'}])await as(claims,()=>assert.rejects(record('clear',report),/FORBIDDEN/));
 await as(null,()=>assert.rejects(record('clear',report),/permission denied/));
 await as(jwt,()=>assert.rejects(record(),/SCREENING_EVIDENCE_REQUIRED/));
 const foreign=(await db.query('select id from glf_kyc_files where case_id<>$1 limit 1',[cid])).rows[0].id;
 await as(jwt,()=>assert.rejects(record('clear',foreign),/SCREENING_EVIDENCE_REQUIRED/));
 await as(jwt,()=>assert.rejects(call('screening',[cid,1,1,'clear','Nota válida para la revisión',report,false]),/INVALID_SCREENING/));
 await as(jwt,()=>record('possible_match',report));
 assert.equal((await get()).screening_revision,2);assert.equal((await get()).review_version,2);
 await as(jwt,()=>assert.rejects(record('clear',report),/STALE_VERSION/));
 let opts={risk:'high',report,issued:dayAt(new Date()),expected:2};
 await as(jwt,()=>assert.rejects(call('finish',[cid,'approved','Prueba de homónimo',true,opts]),/SCREENING_REVIEW_REQUIRED/));
 assert.equal((await get()).state,'review','Rejected finish rolls back the entire decision');
 const inbox=await as(jwt,()=>call('inbox',['SCREENING FICTICIO',0,'review']));assert.equal(inbox.items[0].screening_status,'possible_match');assert.equal(inbox.items[0].screening_by_name,'Responsable');assert.equal(inbox.items[0].screening_note,undefined);
 await as(jwt,()=>record('clear',report,2));
 await as(jwt,()=>call('review',[cid,'correction','Corregir dirección ficticia',false]));const inv=await as(jwt,()=>call('invite',[cid,false]));
 const external=await as(null,()=>call('read',[inv.token]));assert.ok(!JSON.stringify(external).includes('RESERVADO_SCREENING'));assert.equal(external.screening_note,undefined);assert.equal(external.screening_status,undefined);
 const next=await as(null,()=>call('save',[inv.token,1,{...sample(),city:'Otra ciudad ficticia'}]));assert.equal(next,2);
 await db.query("update glf_kyc_cases set state='review' where id=$1",[cid]);
 await as(jwt,()=>assert.rejects(record('clear',report,3,2),/SCREENING_EVIDENCE_REQUIRED/));
 // An otherwise complete final decision must not reuse screening of earlier answers.
 const report2=(await db.query("insert into glf_kyc_files(case_id,slot,path,name,bytes,mime,version) values($1,'report',$2,'FICTICIO_V2.pdf',100,'application/pdf',2) returning id",[cid,cid+'/screening2'])).rows[0].id;
 await db.query("insert into glf_kyc_files(case_id,slot,path,name,bytes,mime,version) values($1,'countersigned',$2,'FICTICIO_V2.pdf',100,'application/pdf',2)",[cid,cid+'/counter2']);
 opts={...opts,report:report2,expected:(await get()).review_version};
 await as(jwt,()=>assert.rejects(call('finish',[cid,'approved','Prueba versión nueva',true,opts]),/SCREENING_REVIEW_REQUIRED/));
 await as(jwt,()=>record('clear',report2,3,2));opts.expected=(await get()).review_version;
 await as(jwt,()=>call('finish',[cid,'approved','Decisión ficticia revisada',true,opts]));
 const closed=await as(jwt,()=>call('inbox',['SCREENING FICTICIO',0,'closed']));assert.equal(closed.total,1);assert.equal(closed.counts.closed,1);assert.equal(closed.counts.approved,1);assert.equal(closed.items[0].screening_status,'clear');assert.ok(closed.items[0].invitation_issued_at);
 await as(jwt,()=>assert.rejects(record('pending',null,4,2),/INVALID_STATE/));
 const events=(await db.query("select detail from glf_kyc_events where case_id=$1 and action='screening_recorded'",[cid])).rows;assert.equal(events.length,3);assert.equal(JSON.parse(events[0].detail).responsible,'Responsable');
 const started=await as(jwt,()=>call('start',[null,cid,'SCREENING FICTICIO','screening@example.test','staff','Nuevo ciclo de prueba']));const nc=(await db.query('select screening_status,screening_file_id from glf_kyc_cases where id=$1',[started.id])).rows[0];assert.equal(nc.screening_status,'pending');assert.equal(nc.screening_file_id,null);
 });
 await t.test('User administration: explicit admin, exact email, MFA, revocation and audit',async()=>{
 const adm=(name,args=[])=>db.query('select glf_admin_'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') result',args).then(r=>r.rows[0].result);
 await as(jwt,()=>assert.rejects(adm('users'),/FORBIDDEN/));await db.query('update glf_profiles set manage_users=true where id=$1',[manager]);
 const perm={supplier_create_scopes:['government'],supplier_edit_scopes:['government'],supplier_archive_scopes:[],manage_specialties:true,manage_users:false,kyc_role:'none'};
 const inviteId=await as(jwt,()=>adm('invite_user',['NEW@example.test','FICTICIO nuevo',perm,'Alta ficticia de prueba']));await as(jwt,()=>assert.rejects(adm('invite_user',['new@example.test','Otra',perm,'Otra prueba']),/INVITE_EXISTS/));
 const target='00000000-0000-4000-8000-000000000009',claim=()=>db.query('select glf_accept_internal_invitation() result').then(r=>r.rows[0].result);
 assert.equal(await as({...jwt,sub:target,email:'wrong@example.test'},claim),false);await as({...jwt,sub:target,email:'new@example.test',aal:'aal1'},()=>assert.rejects(claim(),/FORBIDDEN/));assert.equal(await as({...jwt,sub:target,email:'new@example.test'},claim),true);
 let u=(await db.query('select * from glf_profiles where id=$1',[target])).rows[0];assert.equal(u.kyc_role,'none');assert.equal(u.manage_users,false);assert.equal(u.require_mfa,true);assert.equal(u.contact_email,'new@example.test');assert.deepEqual(u.supplier_edit_scopes,['government']);
 await as({...jwt,sub:target,email:'new@example.test'},()=>assert.rejects(adm('users'),/FORBIDDEN/));await as(jwt,()=>assert.rejects(adm('save_user',[manager,1,{...perm,display_name:'Admin',active:false},'No self changes']),/SELF_CHANGE/));
 await as(jwt,()=>adm('save_user',[target,u.user_version,{...perm,display_name:'FICTICIO editado',active:false},'Baja temporal ficticia']));await as(jwt,()=>assert.rejects(adm('save_user',[target,u.user_version,{...perm,display_name:'FICTICIO editado',active:true},'Cambio obsoleto']),/STALE_VERSION/));
 const cancel=await as(jwt,()=>adm('invite_user',['cancel@example.test','FICTICIO cancelar',perm,'Alta para revocar']));await as(jwt,()=>adm('cancel_invite',[cancel,1,'Revocación ficticia']));assert.equal(await as({...jwt,sub:'00000000-0000-4000-8000-000000000008',email:'cancel@example.test'},claim),false);
 const audit=await as(jwt,()=>adm('users'));assert.ok(audit.events.some(e=>e.action==='invitation_accepted'));assert.ok(audit.events.some(e=>e.action==='permissions_changed'));await as(null,()=>assert.rejects(adm('users'),/permission denied/));
 });
 }finally{await db.close();}
});

