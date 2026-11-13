import {jsPDF} from 'jspdf';
import {number,recordAttachments} from './records-model.js';
export function recordsPdf(data,{logo=null,lang='es',draft=false}={}) {
 const doc=new jsPDF({unit:'mm',format:'a4',compress:true});let y=40;const left=22,right=188,width=166;
 doc.setProperties({title:`${number(data)} · ${data.subject}`,author:'Galápagos Life Fund'});
 const start=()=>{if(logo){doc.saveGraphicsState();doc.roundedRect(157,12,31,13.4,1.5,1.5,null);doc.clip();doc.discardPath();doc.addImage(logo,'PNG',157,12,31,13.4);doc.restoreGraphicsState();}y=40;};
 const room=h=>{if(y+h>266){doc.addPage();start();}};
 const paragraph=(text,{bold=false,size=11,gap=4}={})=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);for(const line of doc.splitTextToSize(String(text||''),width)){room(5.5);doc.text(line,left,y);y+=5.5;}y+=gap;};
 start();
 paragraph(`${data.place||''}, ${data.document_date}`,{size:10});
 paragraph(draft?(lang==='es'?'BORRADOR — sin número definitivo':'DRAFT — no final number'):`${lang==='es'?'Oficio':'Letter'} ${number(data)}`,{bold:true});
 for(const r of data.recipients||[]){if(r.kind==='cc')continue;const c=r.contact||r.party?.contacts?.find(x=>x.is_representative)||{};paragraph([c.name||r.party?.representative||r.party?.contact_name,c.job_title||r.party?.contact_role,r.party?.name].filter(Boolean).join('\n'),{gap:4});}
 paragraph(`${lang==='es'?'Asunto':'Subject'}: ${data.subject}`,{bold:true,gap:6});
 paragraph(lang==='es'?'De mi consideración:':'Dear recipient,');
 for(const p of String(data.body||'').split('\n'))paragraph(p,{gap:2});
 const attachments=recordAttachments(data);if(attachments.length){paragraph(lang==='es'?'Anexos:':'Attachments:',{bold:true,size:10});attachments.forEach((f,i)=>paragraph((i+1)+'. '+f.filename,{size:10,gap:1}));}
 room(43);paragraph(lang==='es'?'Atentamente,':'Sincerely,');y+=15;
 paragraph(data.signer_name||'',{bold:true,gap:0});paragraph(data.job_title||'',{size:10,gap:1});
 paragraph(data.origin_code||'',{size:8,gap:2});
 const copies=(data.recipients||[]).filter(r=>r.kind==='cc');if(copies.length)paragraph((lang==='es'?'Copia: ':'Cc: ')+copies.map(r=>r.party?.name).join('; '),{size:9});

 const total=doc.getNumberOfPages();for(let n=1;n<=total;n++){doc.setPage(n);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(lang==='es'?`Página ${n} de ${total}`:`Page ${n} of ${total}`,right,285,{align:'right'});}
 return {buffer:doc.output('arraybuffer'),pages:total,filename:(draft?'Borrador':number(data))+'.pdf'};
}
