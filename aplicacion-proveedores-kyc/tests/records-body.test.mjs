import test from 'node:test';import assert from 'node:assert/strict';
import {database,ids,as,call} from './records-fixture.mjs';
import {bodyHtml,bodyParagraphs} from '../src/records-body.js';
test('Body formatting is escaped, bounded and backward compatible',()=>{
 assert.match(bodyHtml('<img src=x onerror=alert(1)>',null),/&lt;img/);assert.doesNotMatch(bodyHtml('<script>',null),/<script>/);
 assert.equal(bodyParagraphs('Texto anterior')[0].align,'justify');
 assert.equal(bodyHtml('A😀B',{version:1,paragraphs:[{align:'center',bold:[[1,2]]}]}),'<p class="records-align-center">A<strong>😀</strong>B</p>');
 assert.doesNotMatch(bodyHtml('A',{version:1,paragraphs:[{align:'evil',bold:[[-1,10]]}]}),/evil|strong/);
});
test('Paragraph formatting persists, validates on server and freezes with approved revision',async()=>{
 const db=await database();try{
 await db.query('insert into glf_profiles(id,display_name,manage_users) values($1,$2,true)',[ids.admin,'Prueba formato']);
 const run=fn=>as(db,ids.admin,fn),rpc=(a,id,v,d)=>call(db,a,id,v,d),boot=await run(()=>rpc('bootstrap'));
 await run(()=>rpc('member',null,null,{user_id:ids.admin,unit_id:boot.units[0].id,site_id:boot.sites[0].id,initials:'QA',job_title:'Cargo',roles:[],reason:'Prueba sintética'}));
 const party=await run(()=>rpc('party',null,null,{kind:'institution',name:'Institución sintética'}));
 const format={version:1,paragraphs:[{align:'center',bold:[[0,6]]},{align:'left',bold:[[2,3]]}]};
 const data={direction:'outgoing',subject:'Prueba de formato',body:'Título\nA 😀 ejemplo',body_format:format,classification:'ordinary',signer_id:ids.admin,recipients:[{kind:'to',party_id:party.id}]};
 const id=await run(()=>rpc('save',null,null,data));assert.deepEqual((await run(()=>rpc('read',id))).body_format,format);
 for(const bad of [{version:1,paragraphs:[{align:'right',bold:[]}]},{version:1,paragraphs:[{align:'left',bold:[[0,99]]}]},{version:1,paragraphs:[{align:'left',bold:[],html:'<script>'}]},{version:2,paragraphs:[]}])await assert.rejects(run(()=>rpc('save',id,1,{...data,body_format:bad})),/INVALID_BODY_FORMAT/);
 await run(()=>rpc('submit',id,1));await run(()=>rpc('approve',id,2));const final=await run(()=>rpc('read',id));assert.deepEqual(final.revisions[0].snapshot.body_format,format);
 await assert.rejects(run(()=>rpc('save',id,final.version,data)),/INVALID_STATE/);
 const legacy=await run(()=>rpc('save',null,null,{...data,body_format:null}));assert.equal((await run(()=>rpc('read',legacy))).body_format,null);
 }finally{await db.close();}
});
