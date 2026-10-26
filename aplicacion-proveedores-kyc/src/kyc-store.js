import {createClient} from '@supabase/supabase-js';
import {project,validate,documents} from './kyc-model.js';
const unwrap=async q=>{const {data,error}=await q;if(error)throw error;return data;};
export function createKycStore(config,directory){
 const token=new URLSearchParams(location.hash.slice(1)).get('kyc');
 if(config.mode==='demo')return demo(directory,token);
 const client=token?createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):directory.dataClient;
 const rpc=(name,args)=>unwrap(client.rpc('glf_kyc_'+name,args));
 return {token,demo:false,users:()=>rpc('users',{}),delegate:(target,until,reason)=>rpc('delegate',{p_target:target,p_until:until,p_reason:reason}),
  configure:(id,name,email,relation)=>rpc('configure',{p_id:id,p_name:name,p_email:email,p_relation:relation}),link:(id,supplier)=>rpc('link_supplier',{p_id:id,p_supplier:supplier}),
  async list(){return unwrap(client.from('glf_kyc_cases').select('id,code,supplier_id,name,email,relation,state,version,updated_at,receipt_at').order('updated_at',{ascending:false}).limit(200));},
  async detail(id){const [row,files,events]=await Promise.all([unwrap(client.from('glf_kyc_cases').select('*').eq('id',id).single()),unwrap(client.from('glf_kyc_files').select('*').eq('case_id',id).order('created_at',{ascending:false})),unwrap(client.from('glf_kyc_events').select('*').eq('case_id',id).order('created_at',{ascending:false}).limit(100))]);return {...row,files,events};},
  create:(supplier,name,email,relation)=>rpc('create',{p_supplier:supplier||null,p_name:name,p_email:email,p_relation:relation}),
  invite:(id,scan)=>rpc('invite',{p_id:id,p_scan:scan}),
  read:()=>rpc('read',{p_token:token}),
  save:(row,answers)=>rpc('save',{p_token:token,p_version:row.version,p_answers:project(answers)}),
  pdf:row=>rpc('prepare_pdf',{p_token:token,p_version:row.version}),
  submit:row=>rpc('submit',{p_token:token,p_version:row.version}),
  review:(id,state,note,confirm)=>rpc('review',{p_id:id,p_state:state,p_note:note,p_confirm:confirm}),
  async upload(row,slot,file){const path=await rpc('upload_ticket',{p_token:token||null,p_id:row.id,p_version:row.version,p_slot:slot});await unwrap(client.storage.from('glf-kyc-documents').upload(path,file,{upsert:false,contentType:file.type}));await rpc('attach',{p_token:token||null,p_path:path,p_name:file.name});},
  download:file=>unwrap(client.storage.from('glf-kyc-documents').download(file.path))
 };
}
const key='glf-kyc-pilot-v1';
function demo(directory,token){
 const read=()=>JSON.parse(localStorage.getItem(key)||'{"cases":[]}');const write=d=>localStorage.setItem(key,JSON.stringify(d));
 const allowed=async()=>{const p=await directory.profile();if(!['demo-carolina','demo-monica'].includes(p.id))throw Error('FORBIDDEN');};
 const find=d=>{const c=d.cases.find(c=>c.token===token&&Date.parse(c.expires_at)>Date.now()&&c.state==='invited');if(!c)throw Error('LINK_INVALID');return c;};
 const event=(c,action)=>c.events.unshift({action,created_at:new Date().toISOString(),detail:''});
 return {token,demo:true,async users(){await allowed();return [];},async delegate(){throw Error('FORBIDDEN');},
 async configure(id,name,email,relation){await allowed();const d=read(),c=d.cases.find(c=>c.id===id);c.name=name;c.email=email;c.relation=relation;c.answers=project({...c.answers,name,email,relation});c.token=null;c.version++;c.pdf_version=null;c.state='draft';write(d);},async link(id,supplier){await allowed();const d=read(),c=d.cases.find(c=>c.id===id);c.supplier_id=supplier;write(d);},
 async list(){await allowed();return read().cases;},async detail(id){await allowed();return read().cases.find(c=>c.id===id);},
 async create(supplier,name,email,relation){await allowed();const d=read();const c={id:crypto.randomUUID(),code:d.cases.length+1,supplier_id:supplier,name,email,relation,answers:project({relation,name,email,country:'EC',residenceCountry:'EC',person:'natural'}),state:'draft',version:1,pdf_version:null,files:[],events:[],updated_at:new Date().toISOString()};d.cases.unshift(c);event(c,'created');write(d);return c.id;},
 async invite(id,scan){await allowed();const d=read(),c=d.cases.find(c=>c.id===id);if(!['draft','invited','correction'].includes(c.state))throw Error('INVALID_STATE');c.token=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');c.expires_at=new Date(Date.now()+7*86400000).toISOString();c.state='invited';c.allow_scan=scan;event(c,'invitation_issued');write(d);return {token:c.token,expires_at:c.expires_at};},
 async read(){return find(read());},async save(row,answers){const d=read(),c=find(d);if(c.version!==row.version)throw Error('STALE_VERSION');const a=project(answers);if(a.relation!==c.relation)throw Error('ROUTE_MISMATCH');if(JSON.stringify(c.answers)!==JSON.stringify(a)){c.answers=a;c.version++;c.pdf_version=null;write(d);}return c.version;},
 async pdf(row){const d=read(),c=find(d);if(c.version!==row.version)throw Error('STALE_VERSION');if(validate(c.answers).length)throw Error('INCOMPLETE_FORM');c.pdf_version=c.version;write(d);return true;},
 async upload(row,slot,file){const d=read(),c=token?find(d):d.cases.find(c=>c.id===row.id);if(!token)await allowed();if(c.version!==row.version)throw Error('STALE_VERSION');const id=crypto.randomUUID();await fileDb('readwrite',s=>s.put({id,blob:file}));c.files.unshift({id,path:id,slot,name:file.name,bytes:file.size,version:c.version,created_at:new Date().toISOString()});event(c,'file_attached');write(d);},
 async download(file){return (await fileDb('readonly',s=>s.get(file.id))).blob;},
 async submit(row){const d=read(),c=find(d);if(c.version!==row.version)throw Error('STALE_VERSION');if(validate(c.answers).length||c.pdf_version!==c.version)throw Error('INCOMPLETE_FORM');if(documents(c.answers).some(slot=>!c.files.some(f=>f.slot===slot&&f.version===c.version)))throw Error('MISSING_DOCUMENT');c.state='submitted';c.receipt_at=new Date().toISOString();c.token=null;event(c,'submitted');write(d);return {code:c.code,received_at:c.receipt_at,version:c.version};},
 async review(id,state,note,confirmed){await allowed();const d=read(),c=d.cases.find(c=>c.id===id);if(!note||note.trim().length<5)throw Error('INVALID_REVIEW');if(['approved','not_approved'].includes(state)&&(!confirmed||!c.files.some(f=>f.slot==='report'&&f.version===c.version)))throw Error('REPORT_REQUIRED');if(state==='approved'&&!c.files.some(f=>f.slot==='countersigned'&&f.version===c.version))throw Error('COUNTERSIGN_REQUIRED');c.state=state;c.review_note=note;if(state==='correction')c.note=note;event(c,state);write(d);}
 };
}
function fileDb(mode,action){return new Promise((resolve,reject)=>{const r=indexedDB.open('glf-kyc-pilot-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id'});r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,tx=db.transaction('files',mode),q=action(tx.objectStore('files'));tx.oncomplete=()=>{db.close();resolve(q.result);};tx.onerror=()=>{db.close();reject(tx.error);};};});}
