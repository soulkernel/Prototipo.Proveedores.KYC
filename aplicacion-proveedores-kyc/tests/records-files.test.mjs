import test from 'node:test';import assert from 'node:assert/strict';
import {PDFDocument,PDFName,PDFDict} from 'pdf-lib';
import {inspectRecordFile} from '../src/records-file-check.js';
import {number} from '../src/records-model.js';
test('PDF intake rejects empty, oversize, damaged and encrypted documents without rewriting originals',async()=>{
 const doc=await PDFDocument.create();doc.addPage();const bytes=await doc.save();
 const file=new File([bytes],'entrada.pdf',{type:'application/pdf'}),before=new Uint8Array(await file.arrayBuffer());
 assert.equal((await inspectRecordFile(file,'incoming')).pages,1);assert.deepEqual(new Uint8Array(await file.arrayBuffer()),before);
 await assert.rejects(inspectRecordFile(new File([],'x.pdf',{type:'application/pdf'}),'incoming'),/INVALID_FILE/);
 await assert.rejects(inspectRecordFile(new File([new Uint8Array(20*1024*1024+1)],'x.pdf',{type:'application/pdf'}),'incoming'),/INVALID_FILE/);
 await assert.rejects(inspectRecordFile(new File(['%PDF-broken'],'x.pdf',{type:'application/pdf'}),'incoming'),/INVALID_PDF/);
 const encrypted=await PDFDocument.create();encrypted.addPage();encrypted.context.trailerInfo.Encrypt=encrypted.context.register(PDFDict.withContext(encrypted.context));
 await assert.rejects(inspectRecordFile(new File([await encrypted.save()],'x.pdf',{type:'application/pdf'}),'incoming'),/ENCRYPTED_PDF/);
 assert.equal(number({sequence:1,year:2026}),'C-GLF-0001-2026');
 assert.equal(number({internal_number:'GLF-2026-00002',sequence:2,year:2026}),'GLF-2026-00002');
});
