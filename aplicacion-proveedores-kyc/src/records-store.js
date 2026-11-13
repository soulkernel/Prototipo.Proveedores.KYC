import {inspectRecordFile} from './records-file-check.js';
export async function createRecordsStore(store){
 if(store.demo){const {createRecordsDemo}=await import('./records-demo.js');return createRecordsDemo(store);}
 const client=store.dataClient;
 const unwrap=async promise=>{const {data,error}=await promise;if(error)throw error;return data;};
 const rpc=async(action,id=null,version=null,data={})=>{
  const result=await unwrap(client.rpc('glf_records',{p_action:action,p_id:id,p_version:version,p_data:data}));
  if(action==='read'&&result?.revisions?.[0]){const frozen=result.revisions[0].snapshot;for(const k of ['recipients','author_name','signer_name','job_title','origin_code','place','document_date','body','subject'])result[k]=frozen[k];}
  return result;
 };
 return {rpc,async mailStatus(){try{return await unwrap(client.functions.invoke('correspondence-send',{body:{operation:'status'}}));}catch{return {configured:false};}},async send(doc,mail){return unwrap(client.functions.invoke('correspondence-send',{body:{document_id:doc.id,version:doc.version,...mail}}));},async upload(doc,file,kind,{reason=''}={}){
  const meta=await inspectRecordFile(file,kind);
  if(meta.mime==='application/pdf'&&(await file.slice(0,5).text())!=='%PDF-')throw Error('INVALID_FILE');
  const ticket=await rpc('upload',doc.id,doc.version,{...meta,reason});
  await unwrap(client.storage.from('glf-correspondence').upload(ticket.path,file,{contentType:meta.mime,upsert:false}));
  await rpc('confirm_upload',doc.id,doc.version,{file_id:ticket.id});return ticket.id;
 },async download(file){return unwrap(client.storage.from('glf-correspondence').download(file.path));},async directory(){return (await store.load()).suppliers;}};
}
