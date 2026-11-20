import {day} from './records-model.js';
export const followupLabels={register:['Oficio recibido','Letter received'],assign:['Asignación / reasignación','Assignment / reassignment'],directive:['Disposición registrada','Instruction recorded'],attention:['Atención realizada','Action taken'],close:['Trámite cerrado','Case closed'],reply_created:['Borrador de respuesta creado','Reply draft created'],submit:['Respuesta remitida para firma','Reply submitted for signature'],approve:['Respuesta aprobada','Reply approved'],return:['Respuesta devuelta con observaciones','Reply returned with comments'],verify:['Firma de respuesta verificada','Reply signature verified'],manual_sent:['Envío de respuesta registrado','Reply dispatch recorded'],dispatch_sent:['Envío de respuesta aceptado por Gmail','Reply accepted by Gmail'],dispatch_uncertain:['Envío de respuesta por verificar','Reply dispatch to verify'],dispatch_failed:['Envío de respuesta rechazado','Reply dispatch rejected']};
export const operationalActions=['register','assign','directive','attention','close'];
export const replyActions=['submit','approve','return','verify','manual_sent','dispatch_sent','dispatch_uncertain','dispatch_failed'];
export const replyDraft=doc=>doc.related?.find(r=>r.direction==='outgoing'&&r.status==='draft');
export function replyTemplate(doc,lang='es'){
 const es=lang==='es',date=doc.document_date&&/^\d{4}-\d\d-\d\d$/.test(doc.document_date)?new Intl.DateTimeFormat(es?'es-EC':'en-GB',{dateStyle:'long',timeZone:'UTC'}).format(new Date(doc.document_date+'T12:00:00Z')):'';
 const ref=(doc.external_number?.trim()?`${es?' N.º':' No.'} ${doc.external_number.trim()}`:'')+(date?`${es?', de fecha':', dated'} ${date}`:'');
 return {subject:((es?'Respuesta a: ':'Reply to: ')+doc.subject).slice(0,300),body:es?`En atención al oficio${ref}, referente a «${doc.subject}», me permito informar lo siguiente:\n\n`:`In response to your letter${ref}, regarding “${doc.subject}”, please find the following information:\n\n`};
}
export function latestMainFile(doc){return (doc.files||[]).filter(f=>f.kind==='incoming').sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))||String(b.id).localeCompare(String(a.id)))[0];}
export function attentionStatus(doc,lang='es'){
 const es=lang==='es',replies=(doc.related||[]).filter(r=>r.direction==='outgoing');
 if(doc.status==='closed')return es?'Trámite cerrado':'Case closed';
 if(replies.some(r=>r.sent_at))return es?'Respuesta con envío registrado':'Reply dispatch recorded';
 if(replies.some(r=>['review','prepared','signed'].includes(r.status)))return es?'Respuesta en preparación / firma':'Reply being prepared / signed';
 if(replies.some(r=>r.status==='draft'))return es?'Respuesta en borrador':'Reply in draft';
 return doc.assigned_to?(es?'En atención':'In progress'):(es?'Pendiente de asignación':'Awaiting assignment');
}
export const overdue=doc=>doc.due_date&&doc.due_date<day()&&doc.status!=='closed';
