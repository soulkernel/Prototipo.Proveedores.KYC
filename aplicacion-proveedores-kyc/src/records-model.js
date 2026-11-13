export const permissions=['create','contacts','receive','assign','sign','dispatch','archive'];
export const statusLabels={draft:['Borrador','Draft'],review:['Por firmar','Awaiting approval'],prepared:['Preparado para firma','Ready for signature'],signed:['Firmado','Signed'],sent:['Enviado','Sent'],received:['Recibido','Received'],assigned:['En atención','Assigned'],closed:['Cerrado','Closed'],cancelled:['Anulado','Cancelled']};
export const permissionLabels={create:['Redactar oficios','Draft letters'],contacts:['Gestionar instituciones y contactos','Manage institutions and contacts'],receive:['Registrar recibidos','Register incoming letters'],assign:['Asignar responsables','Assign owners'],sign:['Aprobar y firmar','Approve and sign'],dispatch:['Despachar','Dispatch'],archive:['Cerrar y archivar','Close and archive']};
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const day=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Pacific/Galapagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const localDateTime=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Pacific/Galapagos',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(now).replace(' ','T');
export function dateTimeToISO(value){if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw Error('INVALID_DATE');return new Date(value+':00-06:00').toISOString();}
export const number=d=>d.sequence?`C-GLF-${String(d.sequence).padStart(4,'0')}-${d.year}`:(d.external_number||'—');
export function code(unit,site,initials){return [unit,site,initials].map(v=>String(v||'').trim().toUpperCase()).join('-');}
export function canRecords(bootstrap,permission){return !!(bootstrap?.admin||bootstrap?.permissions?.includes(permission));}
export function validateDocument(d,{submit=false,today=day()}={}){
 const errors=[];
 if(!['outgoing','incoming'].includes(d.direction))errors.push('direction');
 if(d.subject?.trim().length<3||!d.subject||d.subject.length>300)errors.push('subject');
 if(!/^\d{4}-\d\d-\d\d$/.test(d.document_date||'')||Number.isNaN(Date.parse(d.document_date))||new Date(d.document_date).toISOString().slice(0,10)!==d.document_date||d.document_date>today)errors.push('document_date');
 if(!d.recipients?.length||d.recipients.some(r=>!r.party_id&&!r.party?.id)||!d.recipients.some(r=>r.kind===(d.direction==='incoming'?'from':'to')))errors.push('party_id');
 if(d.body?.length>60000||submit&&d.body?.trim().length<10)errors.push('body');
 if(d.direction==='outgoing'&&submit&&!d.signer_id)errors.push('signer_id');
 if(d.direction==='incoming'&&(!d.received_at||Number.isNaN(Date.parse(d.received_at))||Date.parse(d.received_at)>Date.now()))errors.push('received_at');
 return [...new Set(errors)];
}
export function invitationMail(doc,lang='es'){
 doc=doc.revisions?.[0]?.snapshot||doc;
 const to=doc.recipients?.filter(r=>r.kind==='to').map(r=>r.contact?.email||r.party?.email||r.party?.contacts?.[0]?.email).filter(Boolean)||[];
 const cc=doc.recipients?.filter(r=>r.kind==='cc').map(r=>r.contact?.email||r.party?.email||r.party?.contacts?.[0]?.email).filter(Boolean)||[];
 return {to:[...new Set(to)].join(', '),cc:[...new Set(cc)].filter(e=>!to.includes(e)).join(', '),subject:`${number(doc)} · ${doc.subject}`,message:lang==='es'?`Estimado/a destinatario/a:\n\nAdjunto el oficio ${number(doc)}, referente a «${doc.subject}», con sus anexos cuando corresponda.\n\nAgradeceré confirmar su recepción.\n\nGalápagos Life Fund`:`Dear recipient,\n\nPlease find attached letter ${number(doc)} regarding “${doc.subject}”, with its applicable attachments.\n\nPlease acknowledge receipt.\n\nGalápagos Life Fund`};
}
export function fileCheck(file,kind){
 const pdf=file.type==='application/pdf'&&/\.pdf$/i.test(file.name),word=file.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'&&/\.docx$/i.test(file.name);
 if(file.size<1||file.size>20*1024*1024||!(pdf||kind==='source'&&word))throw Error('INVALID_FILE');
 return {kind,filename:file.name,mime:file.type,size:file.size};
}
