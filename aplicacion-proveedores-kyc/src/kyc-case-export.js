import JSZip from 'jszip';
import {jsPDF} from 'jspdf';
import {autoTable} from 'jspdf-autotable';
import {documents,documentLabel,entries,text,fields,fieldLabel} from './kyc-model.js';
import {historyDetail,statusLabel} from './kyc-workflow.js';
import {screeningState,screeningLabels} from './institutional-kyc.js';
import {invitationPerson} from './kyc-invitation.js';

const codeOf=c=>'KYC-'+String(c.code).padStart(5,'0');
const safeName=v=>{const name=String(v||'documento').normalize('NFC').replace(/[^\p{L}\p{N}._-]/gu,'_').replace(/^\.+/,'')||'documento';const ext=name.match(/\.[a-z0-9]{1,6}$/i)?.[0]||'';return name.length>120?name.slice(0,120-ext.length)+ext:name;};
const events={created:['Expediente creado','Case created'],invitation_issued:['Enlace generado / renovado','Link generated / renewed'],invitation_corrected:['Destinatario o ruta corregida','Recipient or route corrected'],supplier_linked:['Ficha comercial vinculada','Commercial record linked'],assistance_started:['Llenado asistido iniciado','Assisted entry started'],answers_saved:['Respuestas guardadas','Answers saved'],assisted_submitted:['Recepción asistida completada','Assisted receipt completed'],file_attached:['Documento incorporado','Document attached'],submitted:['Formulario recibido','Form received'],screening_recorded:['Resultado de screening registrado','Screening result recorded'],review_schedule_set:['Resultado y próxima revisión registrados','Outcome and next review recorded'],review_rescheduled:['Próxima revisión ajustada','Next review adjusted'],cycle_started:['Nueva evaluación vinculada al historial','New assessment linked to history']};
const tr=(lang,es,en)=>lang==='en'?en:es;
function stamp(value,lang){
 if(!value)return '-';
 const date=new Date(value);if(Number.isNaN(date.getTime()))return '-';
 return new Intl.DateTimeFormat(lang==='en'?'en-GB':'es-EC',{dateStyle:'medium',...(/^\d{4}-\d{2}-\d{2}$/.test(value)?{timeZone:'UTC'}:{timeStyle:'short',timeZone:'Pacific/Galapagos'})}).format(date);
}
function folder(slot,lang){
 if(['signed','countersigned'].includes(slot))return tr(lang,'01_Formularios','01_Forms');
 if(slot==='report')return tr(lang,'03_Informes_y_screening','03_Reports_and_screening');
 if(slot==='other')return tr(lang,'04_Documentos_adicionales','04_Additional_documents');
 return tr(lang,'02_Anexos','02_Attachments');
}
function historyNote(event,lang){
 if(!event.detail)return '';
 const rendered=historyDetail(event,lang);
 // Older events may contain machine-only metadata; never expose raw JSON/UUIDs.
 try{const parsed=JSON.parse(rendered);if(parsed&&typeof parsed==='object')return tr(lang,'Actualización registrada en el sistema.','Update recorded in the system.');}catch{}
 return String(rendered||'').replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,tr(lang,'referencia interna','internal reference'));
}
export function caseChecklist(c,index,lang='es'){
 const a={...c.answers,relation:c.relation};
 return [...documents(a),'report','countersigned'].map(slot=>{
  const current=index.filter(f=>f.slot===slot&&f.version===c.version);
  const old=index.some(f=>f.slot===slot);
  const status=current.length?tr(lang,'Disponible','Available'):old?tr(lang,'Pendiente para esta versión; hay archivos anteriores','Pending for this version; earlier files exist'):tr(lang,'Pendiente / no incorporado','Pending / not attached');
  return [documentLabel(slot,a,lang),status,current.map(f=>String(f.number).padStart(3,'0')).join(', ')||'-'];
 });
}

export function caseSummaryPdf(c,index,lang='es',logo=null,now=new Date()){
 const doc=new jsPDF(),t=(es,en)=>tr(lang,es,en),code=codeOf(c),a={...c.answers,relation:c.relation};let y=43;
 const clean=v=>String(v??'-').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[—–]/g,'-');
 function heading(title){if(y>254){doc.addPage();y=43;}doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(25,51,95);doc.text(title,14,y);y+=5;}
 function table(head,body,widths){autoTable(doc,{startY:y,head:[head],body:body.map(row=>row.map(clean)),margin:{left:14,right:14,top:43,bottom:20},styles:{font:'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:[8,119,128]},alternateRowStyles:{fillColor:[245,248,250]},columnStyles:widths||{},rowPageBreak:'avoid'});y=doc.lastAutoTable.finalY+10;}
 function note(value){const lines=doc.splitTextToSize(clean(value),182);for(const line of lines){if(y>270){doc.addPage();y=43;}doc.setTextColor(70);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(line,14,y);y+=4.5;}y+=5;}
 const state=screeningState(c),screening=state==='stale'?t('Revisar cambios: resultado de una versión anterior','Review changes: result from an earlier version'):state==='unrecorded'?t('Sin resultado registrado','No recorded result'):text(screeningLabels[state]||screeningLabels.pending,lang);
 heading(t('Resumen del expediente','Case summary'));
 table([t('Dato','Item'),t('Información','Information')],[
  [t('Nombre / razón social','Full name / legal name'),c.name],[t('Vínculo con GLF','Relationship with GLF'),text(c.relation,lang)],
  [t('Tipo de persona','Applicant type'),invitationPerson(c)?text(invitationPerson(c),lang):t('Por confirmar','To be confirmed')],
  [t('Identificación','Identification'),[text(a.idType,lang),a.id,a.country].filter(Boolean).join(' · ')||t('Pendiente','Pending')],
  [t('Correo del destinatario','Recipient email'),c.email],[t('Estado registrado','Recorded status'),text(c.state,lang)],
  [t('Vigencia KYC','KYC validity'),statusLabel(c,lang)],[t('Versión de respuestas','Answer version'),c.version],
  [t('Recepción del formulario','Form received'),stamp(c.receipt_at,lang)],
  [t('Exportado (hora de Galápagos)','Exported (Galápagos time)'),stamp(now.toISOString(),lang)]
 ],{0:{cellWidth:65}});
 note(t('CONFIDENCIAL. Este resumen organiza la información registrada; no sustituye al formulario firmado, al informe de Cumplimiento ni a la verificación de firmas.','CONFIDENTIAL. This summary organizes recorded information; it does not replace the signed form, the Compliance report or signature verification.'));
 heading(t('Resultado y seguimiento','Outcome and follow-up'));
 table([t('Dato','Item'),t('Registro','Record')],[
  ['Screening',screening],[t('Fecha del screening','Screening recorded'),stamp(c.screening_recorded_at,lang)],
  [t('Riesgo','Risk'),({high:t('Alto','High'),medium:t('Medio','Medium'),low:t('Bajo','Low')})[c.risk_level]||t('Sin registrar','Not recorded')],
  [t('Emisión del informe definitivo','Final report issue date'),stamp(c.report_issued_on,lang)],
  [t('Carga del informe definitivo','Final report uploaded'),stamp(c.report_uploaded_at,lang)],
  [t('Decisión registrada','Decision recorded'),stamp(c.closed_at,lang)],
  [t('Próxima revisión según política','Next review under policy'),stamp(c.policy_due_on,lang)],
  [t('Próxima revisión establecida','Scheduled next review'),stamp(c.review_due_on,lang)],
  [t('Fundamento del screening','Screening rationale'),c.screening_note||t('Sin registrar','Not recorded')],
  [t('Decisión / observaciones de Cumplimiento','Compliance decision / observations'),c.review_note||t('Sin registrar','Not recorded')],
  [t('Motivo de ajuste de fechas','Reason for schedule adjustment'),c.schedule_reason||'-'],
  [t('Excepción de plazo registrada','Recorded interval exception'),c.schedule_exception?t('Sí','Yes'):t('No','No')]
 ].filter(([label,value],i)=>i===0||value!=='-'&&value!==t('Sin registrar','Not recorded')&&(label!==t('Excepción de plazo registrada','Recorded interval exception')||c.schedule_exception)),{0:{cellWidth:65}});
 heading(t('Control documental de la versión actual','Document checklist for the current version'));
 if(!invitationPerson(c))note(t('Lista provisional: falta confirmar si es persona natural o jurídica. Al completar el formulario podrán solicitarse documentos societarios adicionales.','Provisional checklist: individual or legal entity classification is unconfirmed. Completing the form may require additional corporate documents.'));
 table([t('Documento','Document'),t('Disponibilidad','Availability'),t('Índice','Index')],caseChecklist(c,index,lang),{0:{cellWidth:75},1:{cellWidth:88},2:{cellWidth:19}});
 note(t('Disponible indica que existe un archivo de la versión actual; no acredita su revisión, autenticidad o validez. Los archivos anteriores se conservan en el índice.','Available means a file exists for the current answer version; it does not establish review, authenticity or validity. Earlier files are retained in the index.'));
 heading(t('Índice de archivos incluidos','Index of included files'));
 if(!index.length)note(t('Aún no hay documentos cargados. Esta descarga contiene únicamente el resumen del expediente y sus pendientes.','No documents have been uploaded yet. This download contains only the case summary and pending requirements.'));
 else table([t('N.º / versión','No. / version'),t('Documento y ubicación en el ZIP','Document and ZIP location'),t('Registro','Record')],index.map(f=>[
  String(f.number).padStart(3,'0')+'\nv'+f.version,
  f.label+'\n'+t('Original: ','Original: ')+f.original+'\n'+f.path,
  stamp(f.created_at,lang)+'\n'+Math.ceil(f.bytes/1024)+' KB'+(f.version!==c.version?'\n'+t('Versión anterior','Earlier version'):'')+(f.id===c.final_report_id?'\n'+t('Informe definitivo seleccionado','Selected final report'):'')+(f.id===c.screening_file_id?'\n'+t('Evidencia de screening seleccionada','Selected screening evidence'):'')
 ]),{0:{cellWidth:25},1:{cellWidth:108},2:{cellWidth:49}});
 note(t('Los archivos se incluyen sin modificar su contenido. Las carpetas sirven para guardarlos localmente o en Google Drive; esta descarga no realiza una sincronización automática.','Files are included without modifying their contents. Folders can be stored locally or on Google Drive; this download does not synchronize them automatically.'));
 heading(t('Información consignada','Recorded form information'));
 const providedLabels=new Set(fields.filter(f=>a[f.key]!=null&&String(a[f.key]).trim()&&(f.key!=='person'||invitationPerson(c))).map(f=>fieldLabel(f,a,lang)));
 const answers=entries(a,lang).filter(([label])=>providedLabels.has(label)||label.startsWith(t('Socio / accionista ','Owner / shareholder ')));
 if(answers.length)table([t('Campo','Field'),t('Respuesta','Answer')],answers,{0:{cellWidth:74}});else note(t('El formulario todavía no tiene respuestas.','The form has no answers yet.'));
 heading(t('Historial del expediente','Case history'));
 const history=[...(c.events||[])].sort((x,z)=>String(x.created_at||'').localeCompare(String(z.created_at||'')));
 if(history.length)table([t('Fecha (Galápagos)','Date (Galápagos)'),t('Actividad y observaciones','Activity and notes')],history.map(e=>[stamp(e.created_at,lang),text(events[e.action]||e.action,lang)+(e.detail?'\n'+historyNote(e,lang):'')]),{0:{cellWidth:43}});
 else note(t('Sin movimientos registrados.','No recorded activity.'));
 const pages=doc.getNumberOfPages();
 for(let i=1;i<=pages;i++){
  doc.setPage(i);doc.setFillColor(25,51,95);doc.rect(0,0,210,32,'F');
  if(logo)doc.addImage(logo,'PNG',12,5,42,18);
  doc.setFont('helvetica','bold');doc.setTextColor(255);doc.setFontSize(15);doc.text(t('Expediente KYC','KYC case file'),65,13);
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(code+' · '+t('Resumen e índice','Summary and index'),65,22);
  doc.setTextColor(95);doc.setFontSize(8);doc.text(code+' · '+t('CONFIDENCIAL','CONFIDENTIAL'),14,285);doc.text(i+' / '+pages,196,285,{align:'right'});
 }
 return doc;
}

export async function buildCaseArchive(c,store,lang='es',logo=null,now=new Date()){
 const zip=new JSZip(),index=[];
 const files=[...(c.files||[])].sort((a,b)=>folder(a.slot,lang).localeCompare(folder(b.slot,lang))||String(a.slot).localeCompare(String(b.slot))||a.version-b.version||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id)));
 for(const [i,f] of files.entries()){
  let blob;try{blob=await store.download(f);if(!blob||!blob.size)throw Error('EMPTY_DOCUMENT');}catch{throw Error('EXPORT_DOCUMENT_FAILED');}
  const number=i+1,original=String(f.name||'documento'),path=folder(f.slot,lang)+'/'+String(number).padStart(3,'0')+'_v'+f.version+'_'+safeName(original);
  zip.file(path,await blob.arrayBuffer());
  const label=f.slot.startsWith('owner_')&&f.version!==c.version?tr(lang,'Identificación de socio / accionista (versión anterior)','Owner / shareholder ID (earlier version)'):documentLabel(f.slot,{...c.answers,relation:c.relation,owners:c.answers?.owners||[]},lang);
  index.push({id:f.id,number,path,original,slot:f.slot,version:f.version,created_at:f.created_at,bytes:blob.size,label});
 }
 const summary=caseSummaryPdf(c,index,lang,logo,now).output('arraybuffer');
 zip.file(lang==='en'?'00_Case_summary_and_index.pdf':'00_Resumen_e_indice.pdf',summary);
 return {blob:await zip.generateAsync({type:'blob',compression:'DEFLATE'}),filename:codeOf(c)+tr(lang,'_expediente.zip','_case.zip'),index,summary};
}

