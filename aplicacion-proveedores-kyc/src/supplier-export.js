import {exportCriteria} from './export-context.js';
import ExcelJS from 'exceljs';
import {messages} from './i18n.js';
import {searchSuppliers} from './domain.js';

// Export only commercial directory fields, never internal UUIDs or KYC data.
export async function supplierWorkbook(data, filters, lang='es', now=new Date()) {
 const t=k=>messages[lang][k]||k;
 const rows=searchSuppliers(data.suppliers,data.specialties,filters);
 if(!rows.length)throw new Error('EXPORT_EMPTY');
 const workbook=new ExcelJS.Workbook();
 workbook.creator='Galápagos Life Fund';workbook.created=now;
 const sheet=workbook.addWorksheet(t('suppliers'),{views:[{state:'frozen',xSplit:2,ySplit:6,showGridLines:false}]});
 const columns=[['code',15],['legal_name',42],['trade_name',32],['person_type',22],['exportIdType',24],['id_number',24],['tax_number',24],['scope',30],['state',16],['specialty_ids',48],['offer_type',25],['country_name',22],['city',24],['province',24],['address',48],['contact_name',32],['contact_role',28],['email',40],['phone',24],['legal_rep_name',36],['description',60],['keywords',45],['id_country_code',24],['additional_emails',50]];
 sheet.columns=columns.map(([key,width])=>({key,width,style:{numFmt:'@',font:{name:'Arial',size:11},alignment:{vertical:'top',wrapText:true}}}));
 sheet.mergeCells('A1:H1');sheet.getCell('A1').value='GLF · '+t('directory');sheet.getCell('A1').font={name:'Arial',size:18,bold:true,color:{argb:'FF19335F'}};sheet.getRow(1).height=32;
 const timestamp=new Intl.DateTimeFormat(lang==='es'?'es-EC':'en-GB',{dateStyle:'medium',timeStyle:'medium',timeZone:'Pacific/Galapagos'}).format(now);
 sheet.mergeCells('A2:H2');sheet.getCell('A2').value=t('exportCreated')+': '+timestamp+' (Galápagos, UTC−06:00) · '+rows.length+' '+t('results');sheet.getRow(2).height=25;
 const criteria=exportCriteria(filters,data.specialties,lang).map(([key,value])=>key+': '+value);
 sheet.mergeCells('A3:H3');sheet.getCell('A3').value=t('exportFilters')+': '+criteria.join(' · ');sheet.getRow(3).height=48;
 sheet.mergeCells('A4:H4');sheet.getCell('A4').value=t('exportNote');sheet.getCell('A4').font={name:'Arial',size:10,color:{argb:'FF58677C'}};sheet.getRow(4).height=30;
 const names=new Map(data.specialties.map(s=>[s.id,s.name]));
 const values=rows.map(s=>{
  const mapped={...s,code:'PRV-'+String(s.code).padStart(5,'0'),person_type:t(s.person_type),exportIdType:t(s.id_type),id_country_code:new Intl.DisplayNames([lang],{type:'region'}).of(s.id_country_code||s.country_code),additional_emails:(s.additional_emails||[]).map(item=>t(item.label)+': '+item.email).join('; '),scope:t(s.scope),state:t(s.active?'statusActive':'statusInactive'),specialty_ids:s.specialty_ids.map(id=>names.get(id)||'').filter(Boolean).join('; '),offer_type:t(s.offer_type)};
  // Strings remain strings: preserve leading zeroes and prevent formula execution.
  return columns.map(([key])=>String(mapped[key]??''));
 });
 sheet.addTable({name:'GLF_Suppliers',ref:'A6',headerRow:true,style:{theme:'TableStyleMedium2',showRowStripes:true},columns:columns.map(([key])=>({name:t(key),filterButton:true})),rows:values});
 sheet.getRow(6).height=38;
 sheet.getRow(6).eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1E3A6C'}};cell.font={name:'Arial',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={vertical:'middle',wrapText:true};});
 values.forEach((row,i)=>{sheet.getRow(i+7).height=Math.min(409,Math.max(38,...row.map((v,j)=>18*(v.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/(columns[j][1]-3))),0)+1))));});
 sheet.properties.outlineLevelRow=0;
 const stamp=new Intl.DateTimeFormat('sv-SE',{timeZone:'Pacific/Galapagos',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(now).replace(/[^0-9]/g,'');
 return {buffer:await workbook.xlsx.writeBuffer(),filename:'GLF_'+(lang==='es'?'Proveedores':'Suppliers')+'_'+stamp+'.xlsx',count:rows.length};
}

export async function downloadSuppliers(data,filters,lang){
 const result=await supplierWorkbook(data,filters,lang);
 const url=URL.createObjectURL(new Blob([result.buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 const a=document.createElement('a');a.href=url;a.download=result.filename;document.body.appendChild(a);
 try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
 return result.count;
}
