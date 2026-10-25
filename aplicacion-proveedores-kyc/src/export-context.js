import './directory-messages.js';
import {messages} from './i18n.js';
export function exportCriteria(filters,specialties,lang='es'){
 const t=k=>messages[lang][k]||k;
 const pairs=[[t('state'),t(filters.status||'active')]];
 if(filters.q)pairs.push([t('exportSearch'),filters.q]);
 if(filters.scope)pairs.push([t('scope'),t(filters.scope)]);
 if(filters.specialty)pairs.push([t('specialty_ids'),specialties.find(s=>s.id===filters.specialty)?.name||'']);
 if(filters.offer)pairs.push([t('offer_type'),t(filters.offer)]);
 if(filters.city)pairs.push([t('location'),filters.city]);
 return pairs;
}
export function downloadBuffer(buffer,filename,type){
 const url=URL.createObjectURL(new Blob([buffer],{type}));
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);
 try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
