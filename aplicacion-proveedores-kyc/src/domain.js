import {identityTypes,emailLabels} from './supplier-options.js';
export function validateSupplier(s){
 const errors=[],emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 for(const key of ['legal_name','id_number','email','phone','city','country_code','country_name','id_country_code'])if(!String(s[key]||'').trim())errors.push(key);
 if(!s.specialty_ids?.length)errors.push('specialty_ids');
 if(!['natural','legal'].includes(s.person_type))errors.push('person_type');
 if(!['government','glf','shared'].includes(s.scope))errors.push('scope');
 if(!['goods','services','both'].includes(s.offer_type))errors.push('offer_type');
 for(const key of ['country_code','id_country_code'])if(!/^[A-Z]{2}$/.test(s[key]||''))errors.push(key);
 if(!emailPattern.test(s.email))errors.push('email');
 if(!/[0-9]/.test(s.phone||'')||!/^[+0-9(). -]+$/.test(s.phone||'')||String(s.phone).length>50)errors.push('phone');
 if(!identityTypes(s.person_type,s.id_country_code).includes(s.id_type))errors.push('id_type');
 if(s.id_country_code==='EC'&&!(s.id_type==='ruc'?/^\d{13}$/:/^\d{10}$/).test(s.id_number))errors.push('id_number');
 if(s.tax_number&&s.id_country_code==='EC'&&!/^\d{13}$/.test(s.tax_number))errors.push('tax_number');
 for(const [key,value] of Object.entries(s))if(typeof value==='string'&&value.length>(['description','keywords'].includes(key)?2000:250))errors.push(key);
 const emails=s.additional_emails||[];
 if(!Array.isArray(emails)||emails.length>3||emails.some(x=>!emailLabels.includes(x.label)||String(x.email).length>250||!emailPattern.test(x.email)))errors.push('additional_emails');
 else {const all=[s.email,...emails.map(x=>x.email)].map(x=>String(x).toLowerCase());if(new Set(all).size!==all.length)errors.push('additional_emails');}
 const phones=s.additional_phones||[];
 if(!Array.isArray(phones)||phones.length>2||phones.some(x=>typeof x!=='string'||x.length>50||!/[0-9]/.test(x)||!/^[+0-9(). -]+$/.test(x)))errors.push('additional_phones');
 else {const all=[s.phone,...phones].map(x=>String(x).replace(/[^0-9]/g,''));if(new Set(all).size!==all.length)errors.push('additional_phones');}
 return [...new Set(errors)];
}
export const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const compact=value=>String(value??'').replace(/[^a-z0-9]/gi,'').toUpperCase();
export const can=(profile,action,scope)=>!!profile?.active&&(scope==='shared'?(profile['supplier_'+action+'_scopes']||[]).some(s=>['government','glf'].includes(s)):(profile['supplier_'+action+'_scopes']||[]).includes(scope));
export function emptySupplier(scope='government'){return {id:null,version:0,scope,person_type:'natural',country_code:'EC',country_name:'Ecuador',id_country_code:'',additional_emails:[],additional_phones:[],id_type:'cedula',id_number:'',tax_number:'',legal_name:'',trade_name:'',offer_type:'services',description:'',keywords:'',city:'',province:'',address:'',email:'',phone:'',contact_name:'',contact_role:'',legal_rep_name:'',specialty_ids:[],active:true};}
export function normalizeSupplier(input){const out=emptySupplier();for(const key of Object.keys(out)){if(key in input)out[key]=typeof input[key]==='string'?input[key].trim():input[key];}out.country_code=out.country_code.toUpperCase();out.id_country_code=(input.id_country_code||out.country_code).toUpperCase();out.additional_emails=Array.isArray(input.additional_emails)?input.additional_emails.map(x=>({label:String(x.label||'other'),email:String(x.email||'').trim().toLowerCase()})):[];out.additional_phones=Array.isArray(input.additional_phones)?input.additional_phones.map(x=>String(x).trim()).filter(Boolean):[];out.id_number=compact(out.id_number);out.tax_number=compact(out.tax_number);out.email=out.email.toLowerCase();out.specialty_ids=[...new Set(out.specialty_ids)];const allowed=identityTypes(out.person_type,out.id_country_code);if(!allowed.includes(out.id_type))out.id_type=allowed[0];if(out.person_type==='natural')out.legal_rep_name='';if(out.person_type==='legal'||out.id_type==='ruc'||out.id_country_code!=='EC')out.tax_number='';return out;}
export function personIdentity(s){return s.person_type==='natural'&&(s.id_country_code||s.country_code)==='EC'&&['cedula','ruc'].includes(s.id_type)?compact(s.id_number).slice(0,10):'';}
export function isDuplicate(a,b){if((a.id_country_code||a.country_code)!==(b.id_country_code||b.country_code))return false;const ai=compact(a.id_number),bi=compact(b.id_number);if(ai&&a.id_type===b.id_type&&ai===bi)return true;const at=['ruc','tax_id'].includes(a.id_type)?ai:compact(a.tax_number),bt=['ruc','tax_id'].includes(b.id_type)?bi:compact(b.tax_number);if(at&&at===bt)return true;const ap=personIdentity(a),bp=personIdentity(b);return !!ap&&ap.length===10&&ap===bp;}
export function canChangeScope(profile,oldScope,newScope){if(!can(profile,'edit',oldScope))return false;if(oldScope===newScope)return true;if(newScope==='shared')return true;return can(profile,'edit','government')&&can(profile,'edit','glf');}
export function searchSuppliers(rows,specialties,filters){const words=normalize(filters.q).split(' ').filter(Boolean);const byId=new Map(specialties.map(x=>[x.id,x.name]));return rows.filter(s=>{if(filters.status!=='all'&&s.active!==(filters.status!=='inactive'))return false;if(filters.scope&&s.scope!==filters.scope&&!(s.scope==='shared'&&filters.scope!=='shared'))return false;if(filters.specialty&&!s.specialty_ids.includes(filters.specialty))return false;if(filters.offer&&s.offer_type!==filters.offer&&s.offer_type!=='both')return false;if(filters.city&&normalize(s.city)!==normalize(filters.city))return false;const hay=normalize([s.legal_name,s.trade_name,s.id_number,s.tax_number,s.description,s.keywords,s.city,s.country_name,...s.specialty_ids.map(id=>byId.get(id)||'')].join(' '));return words.every(w=>hay.includes(w));}).sort((a,b)=>{const exactA=normalize(a.legal_name).startsWith(normalize(filters.q))?1:0;const exactB=normalize(b.legal_name).startsWith(normalize(filters.q))?1:0;return exactB-exactA||(b.view_count||0)-(a.view_count||0)||a.legal_name.localeCompare(b.legal_name);});}
