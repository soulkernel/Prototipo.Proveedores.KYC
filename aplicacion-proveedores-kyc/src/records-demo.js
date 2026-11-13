// Fictional preview only. Production authorization and persistence are PostgreSQL RPC/RLS.
import {canRecords,code,day,fileCheck,validateDocument,number} from './records-model.js';
import {inspectRecordFile} from './records-file-check.js';
const key='glf-records-demo-v1',uid=()=>crypto.randomUUID(),fail=m=>{throw Error(m);};
const seed=()=>({units:[['DE','Dirección Ejecutiva'],['CO','Cumplimiento y Operaciones'],['FIN','Financiero'],['PROY','Proyectos'],['SOS','Sostenibilidad'],['CONS','Conservación'],['COM','Comunicación']].map(([code,name])=>({id:code,code,name,active:true,version:1})),sites:[{id:'SX',name:'Santa Cruz',code:'SX',active:true,version:1},{id:'SC',name:'San Cristóbal',code:'SC',active:true,version:1}],roles:[{id:'writer',name:'Redacción',permissions:['create','contacts'],version:1},{id:'receiver',name:'Recepción y archivo',permissions:['receive','assign','archive','contacts'],version:1},{id:'signer',name:'Firma',permissions:['sign'],version:1},{id:'dispatcher',name:'Despacho',permissions:['dispatch'],version:1}],members:[['dani','CONS','DR','Oficial de Conservación',['writer','signer']],['mabel','CONS','MC','Asistencia de Conservación',['writer']],['carolina','CO','CA','Cumplimiento y Operaciones',['receiver','writer','signer','dispatcher']],['monica','DE','MC','Dirección Ejecutiva',['writer','receiver','signer','dispatcher']]].map(([id,unit_id,initials,job_title,roles])=>({user_id:'demo-'+id,unit_id,site_id:'SX',initials,job_title,roles,version:1})),parties:[],documents:[],counter:{},events:[]});
const fileDB=()=>new Promise((resolve,reject)=>{const req=indexedDB.open('glf-records-demo-files',1);req.onupgradeneeded=()=>req.result.createObjectStore('files');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
async function blobOp(path,blob){const db=await fileDB();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('files',blob?'readwrite':'readonly'),req=blob?tx.objectStore('files').put(blob,path):tx.objectStore('files').get(path);let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export function createRecordsDemo(store){
 const read=()=>JSON.parse(localStorage.getItem(key)||'null')||seed(),write=x=>localStorage.setItem(key,JSON.stringify(x));
 const users=()=>Object.values({dani:['Redacción de prueba','demo-dani'],mabel:['Mabel','demo-mabel'],carolina:['Cumplimiento de prueba','demo-carolina'],monica:['Administración de prueba','demo-monica'],viewer:['Consulta','demo-viewer']}).map(([name,id])=>({id,name,active:true}));
 async function rpc(action,id=null,version=null,input={}){
  const state=read(),p=await store.profile(),admin=p.id==='demo-monica',member=state.members.find(m=>m.user_id===p.id),perms=[...new Set((member?.roles||[]).flatMap(id=>state.roles.find(r=>r.id===id)?.permissions||[]))],boot={server_time:new Date().toISOString(),admin,member,permissions:perms,units:state.units,sites:state.sites,signers:users().filter(u=>state.members.some(m=>m.user_id===u.id&&(u.id==='demo-monica'||m.roles.some(r=>state.roles.find(x=>x.id===r)?.permissions.includes('sign')))))};
  const can=a=>canRecords(boot,a),doc=state.documents.find(d=>d.id===id),readable=d=>d&&(d.classification==='ordinary'||[d.author_id,d.signer_id,d.assigned_to,...(d.access||[])].includes(p.id));
  const suppliers=(await store.load()).suppliers;
  const party=x=>x?.supplier_id?{...x,...Object.fromEntries(['address','email','phone','legal_rep_name','contact_name','contact_role'].map(k=>[k,suppliers.find(s=>s.id===x.supplier_id)?.[k]||''])),name:suppliers.find(s=>s.id===x.supplier_id)?.legal_name,representative:suppliers.find(s=>s.id===x.supplier_id)?.legal_rep_name}:x;
  const payload=d=>{const m=state.members.find(m=>m.user_id===d.author_id),s=state.members.find(m=>m.user_id===d.signer_id);return {...d,author_name:users().find(u=>u.id===d.author_id)?.name,signer_name:users().find(u=>u.id===d.signer_id)?.name,job_title:s?.job_title,origin_code:code(state.units.find(u=>u.id===d.unit_id)?.code,state.sites.find(u=>u.id===d.site_id)?.code,m?.initials),recipients:d.recipients.map(r=>({...r,party:party(state.parties.find(x=>x.id===r.party_id)),contact:state.parties.find(x=>x.id===r.party_id)?.contacts?.find(c=>c.id===r.contact_id)}))};};
  const event=(action,detail='')=>{const e={action,detail,created_at:new Date().toISOString(),actor_name:p.display_name};if(doc)doc.events.unshift(e);else state.events.push(e);};
  if(action==='bootstrap')return boot;
  if(action==='assignees'){if(!can('assign'))fail('FORBIDDEN');return users();}
  if(action==='admin'){if(!admin)fail('FORBIDDEN');return {...state,users:users()};}
  if(['unit','site','role','member'].includes(action)){
   if(!admin||input.reason?.length<5)fail('FORBIDDEN_OR_REASON');const collection=state[{unit:'units',site:'sites',role:'roles',member:'members'}[action]],old=collection.find(r=>action==='member'?r.user_id===input.user_id:r.id===id);
   if(old&&old.version!==version)fail('STALE_VERSION');
   if(input.code&&!/^[A-Z]{2,10}$/.test(input.code))fail('INVALID');
   if(input.code&&collection.some(x=>x.id!==id&&x.code===input.code))fail('DUPLICATE');
   if(action==='member'&&collection.some(x=>x.user_id!==input.user_id&&x.unit_id===input.unit_id&&x.site_id===input.site_id&&x.initials===input.initials))fail('DUPLICATE');
   if(action==='member'&&(!/^[A-Z]{2,8}$/.test(input.initials)||!state.units.some(x=>x.id===input.unit_id&&x.active)||!state.sites.some(x=>x.id===input.site_id&&x.active)))fail('INVALID');
   const saved={...old,...input,id:old?.id||uid(),version:(old?.version||0)+1,active:input.active??true};delete saved.reason;
   if(old)Object.assign(old,saved);else collection.push(saved);event(action);write(state);return saved.id;
  }
  if(action==='parties')return state.parties.map(party).filter(x=>x.name.toLocaleLowerCase().includes((input.q||'').toLocaleLowerCase())).slice(input.offset||0,(input.offset||0)+50);
  if(action==='party'){
   if(!can('contacts'))fail('FORBIDDEN');let entry=state.parties.find(x=>input.supplier_id?x.supplier_id===input.supplier_id:x.id===id);
   if(entry&&id&&entry.version!==version)fail('STALE_VERSION');
   if(!input.supplier_id&&(!input.name?.trim()||state.parties.some(x=>x.id!==id&&x.name?.toLowerCase()===input.name.toLowerCase())))fail('DUPLICATE_OR_INVALID');
   if(!entry){entry={id:uid(),version:0,contacts:[]};state.parties.push(entry);}
   Object.assign(entry,input.supplier_id?{supplier_id:input.supplier_id}:{name:input.name,kind:input.kind,address:input.address});entry.version++;
   if(input.contact&&Object.values(input.contact).some(v=>typeof v==='string'&&v.trim()))entry.contacts.push({...input.contact,id:uid()});write(state);return party(entry);
  }
  if(action==='filter_people')return users();
  if(action==='list')return {draft_count:state.documents.filter(d=>readable(d)&&d.direction==='outgoing'&&d.status==='draft').length,rows:state.documents.filter(readable).map(d=>({...d,author_name:users().find(u=>u.id===d.author_id)?.name,assigned_name:users().find(u=>u.id===d.assigned_to)?.name,correspondent:d.recipients.map(r=>party(state.parties.find(p=>p.id===r.party_id))?.name).join(' · ')})).filter(d=>{
   const date=d.direction==='incoming'?day(new Date(d.received_at)):d.document_date;
   return (!input.direction||d.direction===input.direction)&&(!input.status||d.status===input.status)&&(!input.person_id||(d.direction==='incoming'?d.assigned_to:d.author_id)===input.person_id)&&(!input.signer_id||d.signer_id===input.signer_id)&&(!input.date_from||date>=input.date_from)&&(!input.date_to||date<=input.date_to)&&(!input.deadline||d.due_date&&!['closed','cancelled'].includes(d.status)&&(input.deadline==='overdue'?d.due_date<day():d.due_date>=day()))&&(!input.q||[d.subject,d.external_number,number(d),d.correspondent].join(' ').toLowerCase().includes(input.q.toLowerCase()));
  }).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).slice(input.offset||0,(input.offset||0)+50)};
  if(action==='save'){
   if(input.direction==='outgoing')input={...input,document_date:day(),place:state.sites.find(s=>s.id===member?.site_id)?.name||''};
   if(!can(input.direction==='incoming'?'receive':'create'))fail('FORBIDDEN');if(!member)fail('MEMBER_REQUIRED');if(validateDocument(input).length)fail('INVALID');
   if(doc&&(!readable(doc)||doc.author_id!==p.id||doc.status!=='draft'||doc.version!==version))fail('STALE_VERSION');
   const allowed=Object.fromEntries(['direction','subject','body','place','document_date','classification','signer_id','external_number','received_at','channel','parent_id','physical_location','recipients'].map(k=>[k,input[k]??null]));
   const fresh=doc||{id:uid(),author_id:p.id,unit_id:member.unit_id,site_id:member.site_id,version:0,status:'draft',files:[],events:[],revisions:[],dispatches:[]};
   Object.assign(fresh,allowed,{version:fresh.version+1,updated_at:new Date().toISOString()});fresh.events.unshift({action:'saved',created_at:fresh.updated_at,actor_name:p.display_name});if(!doc)state.documents.unshift(fresh);write(state);return fresh.id;
  }
  if(!readable(doc))fail('FORBIDDEN');if(action==='read')return {...payload(doc),related:state.documents.filter(d=>(d.parent_id===id||d.id===doc.parent_id)&&readable(d)).map(d=>({id:d.id,subject:d.subject,internal_number:d.internal_number,status:d.status,direction:d.direction}))};if(action==='register'&&doc.internal_number&&can('receive'))return doc.id;if(doc.version!==version)fail('STALE_VERSION');
  if(action==='register'){if(!can('receive')||doc.direction!=='incoming'||!doc.files.some(f=>f.kind==='incoming'))fail('FILE_MISSING');doc.year=Number(day().slice(0,4));const k='incoming-'+doc.year;doc.sequence=(state.counter[k]||0)+1;state.counter[k]=doc.sequence;doc.internal_number='GLF-EXT-'+doc.year+'-'+String(doc.sequence).padStart(5,'0');if(doc.status==='draft')doc.status='received';}
  else if(action==='submit'){if(doc.author_id!==p.id||doc.status!=='draft'||!can('create')||validateDocument(doc,{submit:true}).length)fail('INVALID_STATE');doc.status='review';}
  else if(['approve','return'].includes(action)){if(doc.signer_id!==p.id||doc.status!=='review'||!can('sign'))fail('FORBIDDEN');if(action==='return'){if(input.reason?.length<5)fail('REASON_REQUIRED');doc.status='draft';}else{doc.year=Number(day().slice(0,4));doc.sequence=(state.counter[doc.year]||0)+1;state.counter[doc.year]=doc.sequence;doc.internal_number='GLF-'+doc.year+'-'+String(doc.sequence).padStart(5,'0');doc.status='prepared';doc.document_date=day();doc.revisions.unshift({id:uid(),version:doc.version+1,snapshot:{...payload(doc),files:undefined,events:undefined,revisions:undefined,dispatches:undefined,attachments:doc.files.filter(f=>f.kind==='attachment')}});}}
  else if(action==='assign'){if(!can('assign')||doc.direction!=='incoming'||!['received','assigned'].includes(doc.status))fail('FORBIDDEN');Object.assign(doc,{assigned_to:input.assigned_to,due_date:input.due_date,requires_response:input.requires_response,status:'assigned'});}
  else if(action==='upload'){if(!((input.kind==='signed'&&doc.signer_id===p.id&&can('sign')&&doc.status==='prepared')||(['source','attachment'].includes(input.kind)&&doc.direction==='outgoing'&&doc.author_id===p.id&&doc.status==='draft'&&can('create'))||(['incoming','attachment'].includes(input.kind)&&can('receive')&&doc.direction==='incoming'&&['draft','received','assigned'].includes(doc.status))||(input.kind==='proof'&&can('dispatch')&&doc.status==='signed')))fail('FORBIDDEN');if(input.kind==='incoming'&&doc.files.some(f=>f.kind==='incoming')&&input.reason?.length<5)fail('REPLACEMENT_REASON');const f={id:uid(),...input,document_id:id,confirmed:true};f.path=id+'/'+f.id;doc.files.push(f);doc.version++;write(state);return f;}
  else if(action==='verify'){if(!can('sign')||doc.signer_id!==p.id||doc.status!=='prepared'||input.reason?.length<10||!doc.files.some(f=>f.id===input.file_id&&f.kind==='signed'))fail('INVALID');doc.status='signed';}
  else if(action==='manual_sent'){if(!can('dispatch')||doc.status!=='signed'||input.reason?.length<10||!doc.files.some(f=>f.id===input.proof_file_id&&f.kind==='proof'))fail('INVALID');doc.dispatches.push({...input,method:'manual',status:'sent',sent_at:new Date().toISOString()});doc.status='sent';}
  else if(action==='close'){if(!can('archive')||!['received','assigned','sent'].includes(doc.status)||input.reason?.length<5)fail('FORBIDDEN_OR_STATE');doc.status='closed';}
  else fail('UNKNOWN_ACTION');
  event(action,input.reason);doc.version++;doc.updated_at=new Date().toISOString();write(state);return doc.id;
 }
 return {rpc,async directory(){return (await store.load()).suppliers;},async upload(doc,file,kind,{reason=''}={}){const meta=await inspectRecordFile(file,kind);const ticket=await rpc('upload',doc.id,doc.version,{...meta,reason});await blobOp(ticket.path,file);return ticket.id;},async download(file){const blob=await blobOp(file.path);if(!blob)fail('FILE_MISSING');return blob;}};
}
