import {fileCheck} from './records-model.js';
// Parse only. Never save/rewrite the supplied bytes, which may contain signatures.
export async function inspectRecordFile(file,kind){
 const meta=fileCheck(file,kind);
 if(meta.mime!=='application/pdf')return meta;
 if((await file.slice(0,5).text())!=='%PDF-')throw Error('INVALID_PDF');
 try{
  const {PDFDocument}=await import('pdf-lib');
  const pdf=await PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false,throwOnInvalidObject:true});
  if(pdf.isEncrypted)throw Error('ENCRYPTED_PDF');
  const pages=pdf.getPages();if(!pages.length||pages.some(p=>!Number.isFinite(p.getWidth())||p.getWidth()<=0||p.getHeight()<=0))throw Error('INVALID_PDF');
  return {...meta,pages:pages.length};
 }catch(err){if(/encrypt|password/i.test(String(err)))throw Error('ENCRYPTED_PDF');throw Error('INVALID_PDF');}
}
