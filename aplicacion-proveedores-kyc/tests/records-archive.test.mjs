import test from 'node:test';import assert from 'node:assert/strict';import JSZip from 'jszip';import {archiveBundle} from '../src/records-archive.js';
test('Archive preserves original bytes, escaped index, related documents and explicit incomplete status',async()=>{
 const bytes=new TextEncoder().encode('%PDF-test-bytes');
 const root={id:'a',direction:'incoming',internal_number:'GLF-EXT-2026-00001',subject:'<unsafe>',status:'received',body:'Texto',recipients:[],events:[{action:'assign',detail:'Disposición <prueba>',created_at:'2026-11-21',actor_name:'QA'}],archive_files:[{id:'f',filename:'anexo & prueba.pdf',path:'blob',size:bytes.length,withdrawn_at:'2026-11-21'}],related:[{id:'b'}]};
 const child={...root,id:'b',internal_number:'GLF-2026-00001',subject:'Respuesta',archive_files:[],related:[{id:'a'}]};
 const api={rpc:async(a,id)=>id==='a'?root:child,download:async()=>new Blob([bytes])};
 const out=await archiveBundle(api,'a');assert.equal(out.complete,true);assert.equal(out.entries.length,1);const zip=await JSZip.loadAsync(await out.blob.arrayBuffer());assert.deepEqual(await zip.file(out.entries[0].path).async('uint8array'),bytes);const html=await zip.file('Indice.html').async('string');assert.match(html,/&lt;unsafe&gt;/);assert.match(html,/Respuesta/);assert.match(html,/Disposición &lt;prueba&gt;/);assert.match(out.entries[0].hash,/^[a-f0-9]{64}$/);assert.ok(Object.keys(zip.files).every(x=>!/[.]json$|[.]txt$/i.test(x)));
 const partial=await archiveBundle({...api,download:async()=>{throw Error('not available');}},'a');assert.equal(partial.complete,false);assert.match(partial.filename,/INCOMPLETO/);assert.match(await (await JSZip.loadAsync(await partial.blob.arrayBuffer())).file('Indice.html').async('string'),/RESPALDO INCOMPLETO/);
 await assert.rejects(archiveBundle({rpc:async()=>{throw Error('FORBIDDEN');}},'a'),/ARCHIVE_UNAVAILABLE/);
});
