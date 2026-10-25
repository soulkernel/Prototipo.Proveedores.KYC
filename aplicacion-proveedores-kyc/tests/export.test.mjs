import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {supplierWorkbook} from '../src/supplier-export.js';
import {emptySupplier} from '../src/domain.js';
const data={specialties:[{id:'sp1',name:'Climatización'},{id:'sp2',name:'Consultoría'}],suppliers:Array.from({length:20},(_,i)=>({...emptySupplier(i%2?'glf':'government'),id:'private-uuid-'+i,code:i+1,legal_name:i===0?'=HYPERLINK("https://example.test")':'Proveedor '+i,id_number:'0000000001',phone:'+593000000000',email:'demo@example.test',city:i%2?'Quito':'Santa Cruz',specialty_ids:[i%2?'sp2':'sp1'],active:i!==19,kyc_private:'NEVER EXPORT'}))};
const filters={q:'',scope:'',specialty:'',offer:'',city:'',status:'all'};
async function read(result){const wb=new ExcelJS.Workbook();await wb.xlsx.load(result.buffer);return wb.worksheets[0];}
test('XLSX includes all pages, preserves text IDs, and excludes private/internal fields',async()=>{
 const result=await supplierWorkbook(data,filters,'es',new Date('2026-10-26T02:00:00Z'));
 const sheet=await read(result);
 assert.equal(result.count,20);assert.equal(sheet.rowCount,26);assert.match(result.filename,/20261025200000/);
 assert.equal(sheet.getCell('F7').type,ExcelJS.ValueType.String);assert.equal(sheet.getCell('F7').value,'0000000001');
 assert.equal(sheet.getCell('S7').value,'+593000000000');
 const values=[];sheet.eachRow(row=>row.eachCell(cell=>{assert.notEqual(cell.type,ExcelJS.ValueType.Formula);values.push(cell.text);}));
 assert(values.some(s=>s.startsWith('=HYPERLINK')));assert(!values.join(' ').includes('private-uuid'));assert(!values.join(' ').includes('NEVER EXPORT'));
 assert.equal(sheet.views[0].ySplit,6);assert.equal(sheet.views[0].xSplit,2);assert(sheet.getTable('GLF_Suppliers'));
});
test('combined filters and inactive supplier export agree with the directory; English labels work',async()=>{
 const selected=await supplierWorkbook(data,{...filters,scope:'glf',city:'quito',specialty:'sp2',status:'inactive'},'en');
 const sheet=await read(selected);assert.equal(selected.count,1);assert.equal(sheet.name,'Suppliers');assert.equal(sheet.getCell('B7').value,'Proveedor 19');assert.equal(sheet.getCell('I7').value,'Inactive');assert.match(sheet.getCell('A3').text,/Inactive/);
});
test('empty search does not generate a misleading export',async()=>{
 await assert.rejects(supplierWorkbook(data,{...filters,q:'no matching supplier'}),/EXPORT_EMPTY/);
});
