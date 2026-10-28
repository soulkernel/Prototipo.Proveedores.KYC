import {jsPDF} from 'jspdf';
import {autoTable} from 'jspdf-autotable';
import {entries,KYC_VERSION} from './kyc-model.js';
export function makeKycPdf(row,lang,logo){
 const doc=new jsPDF(),en=lang==='en',code='KYC-'+String(row.code).padStart(5,'0');
 doc.setFillColor(25,51,95);doc.rect(0,0,210,32,'F');if(logo)doc.addImage(logo,'PNG',12,5,42,18);doc.setTextColor(255);doc.setFontSize(16);doc.text('GLF · KYC',65,13);doc.setFontSize(9);doc.text(code+' · '+(en?'Answer version ':'Versión de respuestas ')+row.version,65,21);
 doc.setTextColor(25,51,95);doc.setFontSize(11);doc.text(en?'CONFIDENTIAL':'CONFIDENCIAL',12,41);
 autoTable(doc,{startY:47,head:[[en?'Field':'Campo',en?'Answer':'Respuesta']],body:entries(row.answers,lang),margin:{left:12,right:12,bottom:22},styles:{font:'helvetica',fontSize:9,cellPadding:3,overflow:'linebreak'},columnStyles:{0:{cellWidth:74}},headStyles:{fillColor:[8,119,128]},didDrawPage:()=>{}});
 let y=doc.lastAutoTable.finalY+14;if(y>210){doc.addPage();y=22;}
 doc.setFontSize(10);doc.text(doc.splitTextToSize(en?'Applicant: I declare that the information supplied is complete and accurate.':'Declarante: confirmo que la información consignada es completa y veraz.',182),14,y);y+=24;
 doc.setDrawColor(180);doc.roundedRect(12,y,90,44,2,2);doc.roundedRect(108,y,90,44,2,2);doc.setFontSize(9);
 doc.text(en?'Applicant / representative signature':'Firma del declarante / representante',16,y+8);doc.text(doc.splitTextToSize(row.answers.legalRep||row.answers.name||'',80),16,y+17);
 doc.text(en?'Compliance verification signature':'Firma de verificación de Cumplimiento',112,y+8);doc.text(doc.splitTextToSize(en?'GLF Compliance officer / authorized delegate':'Responsable de Cumplimiento GLF / delegado autorizado',80),112,y+17);
 doc.setFontSize(8);doc.text(doc.splitTextToSize(en?'Apply signatures with an external signing tool. The first signature must allow the second signature. GLF checks validity and correspondence before closing the case.':'Aplique las firmas con una herramienta externa. La primera firma debe permitir agregar la segunda. GLF verifica la validez y correspondencia antes de cerrar el expediente.',182),14,y+55);
 for(let i=1;i<=doc.getNumberOfPages();i++){doc.setPage(i);doc.setTextColor(90);doc.setFontSize(8);doc.text(code+' · '+KYC_VERSION+' · v'+row.version,12,285);doc.text(i+' / '+doc.getNumberOfPages(),195,285,{align:'right'});}
 return doc;
}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
