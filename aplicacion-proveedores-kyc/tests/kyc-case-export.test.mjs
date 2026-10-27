import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {buildCaseArchive,caseChecklist} from '../src/kyc-case-export.js';

const date=new Date('2026-10-27T22:00:00Z');
const minimal={code:99999,name:'PERSONA FICTICIA',email:'prueba@example.test',relation:'staff',state:'draft',version:2,answers:{relation:'staff',person:'natural',name:'PERSONA FICTICIA'},files:[],events:[]};
test('Empty case produces only a readable PDF, with staff requirements and no technical files',async()=>{
 const out=await buildCaseArchive(minimal,{download(){throw Error('unexpected');}},'es',null,date);
 const zip=await JSZip.loadAsync(await out.blob.arrayBuffer());
 assert.deepEqual(Object.keys(zip.files),['00_Resumen_e_indice.pdf']);
 assert.equal((await zip.file('00_Resumen_e_indice.pdf').async('nodebuffer')).subarray(0,5).toString(),'%PDF-');
 const checklist=caseChecklist(minimal,[]);assert.equal(checklist.length,5);assert(checklist.some(r=>r[0].includes('CV')));assert(!checklist.some(r=>r[0].includes('bancario')));
 assert(checklist.every(r=>r[1]==='Pendiente / no incorporado'));
});
test('Archives every original byte and version, preserves duplicate names, and keeps safe paths/extensions',async()=>{
 const files=['signed','signed','identity','report','countersigned','other'].map((slot,i)=>({id:String(i),slot,name:i===2?'../'+('nombre'.repeat(30))+'.png':'archivo.pdf',version:i===0?1:2,created_at:'2026-10-27T22:00:00Z'}));
 const originals=new Map(files.map(f=>[f.id,new Uint8Array([37,80,68,70,45,0,Number(f.id),255,13,10])]));
 const out=await buildCaseArchive({...minimal,files},{download:async f=>new Blob([originals.get(f.id)])},'en',null,date);
 const zip=await JSZip.loadAsync(await out.blob.arrayBuffer());
 assert.equal(Object.values(zip.files).filter(f=>!f.dir).length,7);
 assert(zip.file('00_Case_summary_and_index.pdf'));
 for(const item of out.index){assert.deepEqual(new Uint8Array(await zip.file(item.path).async('arraybuffer')),originals.get(item.id));assert(!item.path.includes('..'));assert(item.path.endsWith(item.slot==='identity'?'.png':'.pdf'));}
 assert.equal(new Set(out.index.map(f=>f.path)).size,6);
 assert(out.index.some(f=>f.version===1));
 assert(!Object.keys(zip.files).some(p=>/\.(json|txt)$/i.test(p)));
 const rows=caseChecklist({...minimal,files},out.index,'en');assert(rows.find(r=>r[0].startsWith('Signed'))[1]==='Available');
});
test('Earlier attachments do not satisfy the current version and unavailable downloads fail the entire export',async()=>{
 const old={slot:'signed',version:1,number:1};assert.match(caseChecklist(minimal,[old])[0][1],/Pendiente para esta versión/);
 for(const download of [async()=>{throw Error('403');},async()=>new Blob([])])await assert.rejects(()=>buildCaseArchive({...minimal,files:[{id:'x',slot:'signed',name:'signed.pdf',version:2}]},{download}),/EXPORT_DOCUMENT_FAILED/);
});

