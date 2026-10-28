import {sourcesField} from './kyc-sources.js';
import {declarations,kinships,incomeSources,parseList} from './kyc-declarations.js';
import {callingCountries,splitPhone,phoneValue} from './kyc-contact-fields.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reviewField(f,s,lang,assisted=false){
 const en=lang==='en',t=(es,english)=>en?english:es,v=s[f.key]||'',label=f.label[en?1:0];
 if(f.type==='consent')return `<label class="kyc-check kyc-declaration" data-error-key="${f.key}"><input type="checkbox" data-field="${f.key}" ${v==='yes'?'checked':''}><span><strong>${esc(label)} *</strong>${assisted?'<br><em>'+t('Transcribo esta declaración recibida para revisión y firma del declarante; no firmo en su nombre.','I transcribe this received declaration for the applicant to review and sign; I do not sign on their behalf.')+'</em>':''}<br>${esc(declarations[f.key][en?1:0])}</span></label>`;
 if(f.type==='sources')return sourcesField(s,lang);
 if(f.key==='phoneAdditional'){
  const p=splitPhone(v,'EC');return `<details class="kyc-extra-phone" ${v?'open':''}><summary>${t('Agregar teléfono adicional (opcional)','Add another phone (optional)')}</summary><div class="kyc-phone-row" data-error-key="phoneAdditional"><label>${t('Código de país','Country code')}<select id="kyc-extra-phone-country">${callingCountries('',lang).map(o=>`<option value="${o.country}" ${o.country===p.country?'selected':''}>${esc(o.name)} (${o.code})</option>`).join('')}</select></label><label>${t('Teléfono adicional','Additional phone')}<input id="kyc-extra-phone-number" type="tel" maxlength="50" value="${esc(p.number)}"></label></div></details>`;
 }
 if(['pepRelatives','glfRelatives'].includes(f.type)){
  const rows=parseList(v),pep=f.type==='pepRelatives';
  return `<div class="kyc-wide" data-relative-group="${f.key}" data-error-key="${f.key}">${rows.map((r,i)=>`<fieldset><legend>${t('Familiar adicional','Additional relative')} ${i+1}</legend><div class="form-grid">${[['name',t('Nombre completo','Full name')],['relationship',t('Parentesco','Relationship')],...(r.relationship==='other'?[['other',t('Indique el parentesco','Specify relationship')]]:[]),['position',pep?t('Cargo que ejerce o ejerció','Position held now or previously'):t('Cargo o función en GLF','Role at GLF')],...(pep?[['institution',t('Institución u organismo','Institution or organization')],['country',t('País del cargo','Country of position')]]:[])].map(([key,l])=>`<label>${l} *${key==='relationship'?`<select data-relative="${i}" data-part="${key}"><option value="">${t('Seleccione','Select')}</option>${kinships.map(k=>`<option value="${k[0]}" ${r[key]===k[0]?'selected':''}>${esc(k[en?2:1])}</option>`).join('')}</select>`:key==='country'?`<select data-relative="${i}" data-part="${key}"><option value="">${t('Seleccione','Select')}</option>${callingCountries('',lang).map(o=>`<option value="${o.country}" ${r[key]===o.country?'selected':''}>${esc(o.name)}</option>`).join('')}</select>`:`<input maxlength="250" data-relative="${i}" data-part="${key}" value="${esc(r[key])}">`}</label>`).join('')}</div><button type="button" class="secondary" data-remove-relative="${i}">${t('Quitar familiar','Remove relative')}</button></fieldset>`).join('')}${rows.length<20?`<button type="button" class="secondary" data-add-relative>${t('Agregar otro familiar','Add another relative')}</button>`:''}</div>`;
 }
 return null;
}
export function readReviewFields(root,answers){
 const boxes=root.querySelectorAll('[data-source]');if(boxes.length)answers.incomeSources=JSON.stringify([...boxes].filter(c=>c.checked).map(c=>c.dataset.source));
 const phone=root.querySelector('#kyc-extra-phone-number');if(phone)answers.phoneAdditional=phoneValue(root.querySelector('#kyc-extra-phone-country').value,phone.value);
 root.querySelectorAll('[data-relative-group]').forEach(group=>{const key=group.dataset.relativeGroup,rows=parseList(answers[key]);group.querySelectorAll('[data-relative]').forEach(el=>{rows[+el.dataset.relative][el.dataset.part]=el.value;});answers[key]=JSON.stringify(rows);});
}
export function bindReviewFields(root,answers,onChange){
 root.querySelectorAll('[data-source],#kyc-extra-phone-country,#kyc-extra-phone-number,[data-relative]').forEach(el=>{
  el.addEventListener('input',()=>onChange(false));
  if(el.matches('select[data-relative]'))el.addEventListener('change',()=>onChange(true));
 });
 root.querySelectorAll('[data-relative-group]').forEach(group=>{
  const key=group.dataset.relativeGroup;
  group.querySelector('[data-add-relative]')?.addEventListener('click',()=>{onChange(false);const rows=parseList(answers()[key]);if(rows.length<20)rows.push({name:'',relationship:'',other:'',position:'',institution:'',country:''});answers()[key]=JSON.stringify(rows);onChange(true,true);});
  group.querySelectorAll('[data-remove-relative]').forEach(b=>b.addEventListener('click',()=>{onChange(false);const rows=parseList(answers()[key]);rows.splice(+b.dataset.removeRelative,1);answers()[key]=JSON.stringify(rows);onChange(true,true);}));
 });
}
