import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierPdf} from '../src/supplier-pdf.js';
import {emptySupplier} from '../src/domain.js';
const data={specialties:[{id:'1',name:'Consultoría ambiental'}],suppliers:Array.from({length:20},(_,i)=>({...emptySupplier(),code:i+1,legal_name:'Proveedor ficticio '+i,id_number:'0000000001',city:'Santa Cruz',email:'demo@example.test',phone:'0000000000',specialty_ids:['1'],active:i!==19}))};
test('PDF handles multiple pages, filtering, and an empty result',()=>{
 const all=supplierPdf(data,{status:'all'},'es',new Date('2026-10-26T02:00:00Z'));
 assert.equal(all.count,20);assert(all.pages>=2);assert.match(all.filename,/20261025200000/);assert.equal(Buffer.from(all.buffer).subarray(0,5).toString(),'%PDF-');
 assert.equal(supplierPdf(data,{status:'inactive'},'en').count,1);
 assert.throws(()=>supplierPdf(data,{status:'all',q:'no match'}),/EXPORT_EMPTY/);
});
