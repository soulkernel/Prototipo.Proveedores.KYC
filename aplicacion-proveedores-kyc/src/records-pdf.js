import {jsPDF} from 'jspdf';
import {number,recordAttachments} from './records-model.js';

export function recordsPdf(data,{logo=null,lang='es',draft=false}={}) {
 const es=lang==='es',doc=new jsPDF({unit:'mm',format:'a4',compress:true});
 const left=25,right=185,width=right-left,bottom=268;let y=40;
 doc.setProperties({title:`${number(data)} · ${data.subject}`,author:'Galápagos Life Fund'});
 const font=(size=11,bold=false)=>{doc.setFont('times',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(0);};
 const start=()=>{
  doc.setFont('helvetica','bold');doc.setFontSize(17);doc.setTextColor(30,57,105);
  doc.text('Galápagos Life Fund',left,22);
  if(logo){doc.saveGraphicsState();doc.roundedRect(154,12,31,13.4,1.5,1.5,null);doc.clip();doc.discardPath();doc.addImage(logo,'PNG',154,12,31,13.4);doc.restoreGraphicsState();}
  font();y=40;
 };
 const room=h=>{if(y+h>bottom){doc.addPage();start();}};
 const lines=(text,size=11,bold=false,available=width)=>{font(size,bold);return doc.splitTextToSize(String(text||''),available);};
 const paragraph=(text,{bold=false,size=11,gap=3,align='left',indent=0}={})=>{
  if(!text)return;
  const wrapped=lines(text,size,bold,width-indent),leading=size*.48;
  wrapped.forEach((line,i)=>{room(leading);font(size,bold);
   if(align==='justify'&&i<wrapped.length-1&&line.trim().includes(' ')){
    const words=line.trim().split(/\s+/),spacing=(width-indent-words.reduce((sum,word)=>sum+doc.getTextWidth(word),0))/(words.length-1);let x=left+indent;
    for(const word of words){doc.text(word,x,y);x+=doc.getTextWidth(word)+spacing;}
   }
   else doc.text(line,align==='right'?right:left+indent,y,{align:align==='right'?'right':'left'});
   y+=leading;
  });y+=gap;
 };
 const recipient=(r,copy=false,heading=false)=>{
  const p=r.party||{},c=r.contact||p.contacts?.find(x=>x.is_representative)||{};
  const name=c.name||p.representative||p.contact_name||'',role=c.job_title||p.contact_role||'';
  const rows=[[c.salutation||'',false],[name,false],[role,true],[p.name!==name?p.name:'',true]].filter(([s])=>s);
  const size=copy?9:11,indent=copy?7:0;
  room(rows.reduce((h,[s,b])=>h+lines(s,size,b,width-indent).length*size*.48,0)+8+(heading?6:0));
  if(heading)paragraph(es?'Copia:':'Cc:',{size:9,gap:1});
  for(const [text,bold] of rows)paragraph(text,{bold,size,indent,gap:0});
  if(!copy)paragraph(es?'En su Despacho':'Present',{gap:5});else y+=4;
 };
 start();
 paragraph(draft?(es?'BORRADOR - sin número definitivo':'DRAFT - no final number'):`${es?'Oficio Nro.':'Letter No.'} ${number(data)}`,{bold:true,align:'right',gap:2});
 const rawDate=String(data.document_date||'');
 const date=/^\d{4}-\d{2}-\d{2}$/.test(rawDate)?new Intl.DateTimeFormat(es?'es-EC':'en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}).format(new Date(rawDate+'T12:00:00Z')):rawDate;
 const place=({'Santa Cruz':'Puerto Ayora','San Cristóbal':'Puerto Baquerizo Moreno'})[data.place]||data.place||'';
 paragraph([place,date].filter(Boolean).join(', '),{bold:true,align:'right',gap:8});
 // Only the label is bold; the subject continues with a hanging indent.
 const label=es?'Asunto:':'Subject:';font(11,true);const labelWidth=doc.getTextWidth(label)+3;
 const subject=lines(data.subject,11,false,width-labelWidth);room(Math.min(subject.length*5.3+8,30));
 subject.forEach((line,i)=>{room(5.3);if(i===0){font(11,true);doc.text(label,left,y);}font();doc.text(line,left+labelWidth,y);y+=5.3;});y+=7;
 for(const r of data.recipients||[])if(r.kind!=='cc')recipient(r);
 room(17);paragraph(es?'De mi consideración:':'Dear recipient,',{gap:5});
 for(const p of String(data.body||'').split('\n')){if(p.trim())paragraph(p,{gap:3,align:'justify'});else y+=2;}
 const signerHeight=lines(data.signer_name||'').length*5.28+lines(data.job_title||'',11,true).length*5.28;
 room(30+signerHeight);paragraph(es?'Atentamente,':'Sincerely,',{gap:0});y+=17;
 paragraph(data.signer_name||'',{gap:0});paragraph(data.job_title||'',{bold:true,gap:5});
 const attachments=recordAttachments(data);
 if(attachments.length){room(14);paragraph(es?'Anexos:':'Attachments:',{size:9,gap:1});for(const f of attachments)paragraph('- '+f.filename,{size:9,indent:4,gap:1});y+=3;}
 const copies=(data.recipients||[]).filter(r=>r.kind==='cc');
 copies.forEach((r,i)=>recipient(r,true,i===0));
 paragraph(data.origin_code||'',{size:8,gap:0});
 const total=doc.getNumberOfPages();
 for(let n=1;n<=total;n++){doc.setPage(n);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(0);doc.text(es?`Página ${n} de ${total}`:`Page ${n} of ${total}`,right,285,{align:'right'});}
 return {buffer:doc.output('arraybuffer'),pages:total,filename:(draft?'Borrador':number(data))+'.pdf'};
}
