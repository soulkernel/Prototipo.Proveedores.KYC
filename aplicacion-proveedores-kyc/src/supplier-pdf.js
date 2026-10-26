import {jsPDF} from 'jspdf';
import {autoTable} from 'jspdf-autotable';
import {messages} from './i18n.js';
import {searchSuppliers} from './domain.js';
import {exportCriteria,downloadBuffer} from './export-context.js';
export function supplierPdf(data,filters,lang='es',now=new Date(),logo=null){
 const t=k=>messages[lang][k]||k,rows=searchSuppliers(data.suppliers,data.specialties,filters);
 if(!rows.length)throw Error('EXPORT_EMPTY');
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 doc.setProperties({title:'GLF - '+t('directory'),author:'Galápagos Life Fund'});
 const navy=[30,58,108],width=297,margin=12;
 doc.setFillColor(...navy);doc.rect(0,0,width,29,'F');
 if(logo)doc.addImage(logo,'PNG',12,4,43,18.5);
 doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text(t('directory'),logo?62:12,16);
 doc.setFont('helvetica','normal');doc.setFontSize(9);
 const time=new Intl.DateTimeFormat(lang==='es'?'es-EC':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Pacific/Galapagos'}).format(now);
 doc.text(time+' (Galápagos, UTC-06:00) | '+rows.length+' '+t('results'),logo?62:12,23);
 autoTable(doc,{startY:34,margin:{left:margin,right:margin,bottom:18},theme:'plain',styles:{font:'helvetica',fontSize:9,cellPadding:1.5,textColor:[35,49,68]},columnStyles:{0:{cellWidth:38,fontStyle:'bold'},1:{cellWidth:235}},body:exportCriteria(filters,data.specialties,lang)});
 const specs=new Map(data.specialties.map(s=>[s.id,s.name]));
 autoTable(doc,{startY:doc.lastAutoTable.finalY+6,margin:{top:15,left:margin,right:margin,bottom:18},theme:'striped',styles:{font:'helvetica',fontSize:9,cellPadding:2.5,overflow:'linebreak',valign:'top',textColor:[35,49,68]},headStyles:{fillColor:navy,textColor:255,fontStyle:'bold'},alternateRowStyles:{fillColor:[245,248,251]},rowPageBreak:'avoid',showHead:'everyPage',
  head:[[t('name'),t('identification'),t('offer'),t('location'),t('contact'),t('state')]],
  columnStyles:{0:{cellWidth:54},1:{cellWidth:38},2:{cellWidth:62},3:{cellWidth:36},4:{cellWidth:63},5:{cellWidth:20}},
  body:rows.map(s=>['PRV-'+String(s.code).padStart(5,'0')+'\n'+s.legal_name+'\n'+t(s.scope),t(s.person_type)+'\n'+t(s.id_type)+': '+s.id_number+'\n'+new Intl.DisplayNames([lang],{type:'region'}).of(s.id_country_code||s.country_code)+(s.tax_number?'\nRUC: '+s.tax_number:''),t(s.offer_type)+'\n'+s.specialty_ids.map(id=>specs.get(id)||'').filter(Boolean).join('; '),s.city+'\n'+s.country_name,[s.contact_name,s.email,...(s.additional_emails||[]).map(item=>t(item.label)+': '+item.email),s.phone,...(s.additional_phones||[])].filter(Boolean).join('\n'),t(s.active?'statusActive':'statusInactive')])});
 const pages=doc.getNumberOfPages();
 for(let i=1;i<=pages;i++){doc.setPage(i);doc.setDrawColor(210);doc.line(margin,196,width-margin,196);doc.setTextColor(80);doc.setFontSize(8);doc.text(t('pdfFooter'),margin,201);doc.text(`${i} / ${pages}`,width-margin,201,{align:'right'});}
 const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Pacific/Galapagos',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now).replace(/[^0-9]/g,'');
 return {buffer:doc.output('arraybuffer'),filename:'GLF_'+(lang==='es'?'Proveedores':'Suppliers')+'_'+stamp+'.pdf',count:rows.length,pages};
}
export function downloadSupplierPdf(data,filters,lang,logo){const result=supplierPdf(data,filters,lang,new Date(),logo);downloadBuffer(result.buffer,result.filename,'application/pdf');return result.count;}
