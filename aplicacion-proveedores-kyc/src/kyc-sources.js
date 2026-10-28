import {incomeSources,parseList} from './kyc-declarations.js';
import {searchableSelect,bindSearchableSelect,helpIcon} from './kyc-compact-controls.js';
import {fieldHelp} from './kyc-field-guidance.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
export function sourceOptions(s,query='',lang='es'){
 const selected=parseList(s.incomeSources),rows=incomeSources.filter(o=>o[0]!=='sales'&&(s.person==='legal'?!['salary','pension','savings','inheritance'].includes(o[0]):!['capital','grants'].includes(o[0]))).filter(o=>!selected.includes(o[0])&&normalize(o[1]+' '+o[2]).includes(normalize(query)));
 return {count:rows.length,html:'<option value="">'+(lang==='en'?'Select sources':'Seleccione fuentes')+'</option>'+rows.map(o=>'<option value="'+o[0]+'">'+esc(o[lang==='en'?2:1])+'</option>').join('')};
}
export function sourcesField(s,lang='es'){
 const en=lang==='en',t=(a,b)=>en?b:a,title=t('¿Cuáles son las principales fuentes de sus ingresos y recursos?','What are the main sources of your income and resources?'),selected=parseList(s.incomeSources);
 return '<div class="kyc-wide kyc-sources" data-error-key="incomeSources"><div class="kyc-field-title"><label for="kyc-source-select-trigger">'+title+' *</label>'+helpIcon('help-sources',t('Ayuda: fuentes de ingresos','Help: income sources'),fieldHelp('incomeSources',s,lang))+'</div>'+searchableSelect('kyc-source-select',title,sourceOptions(s,'',lang).html,t('Seleccione una o varias fuentes','Select one or more sources'),lang)+'<div class="kyc-choice-tags">'+selected.map(k=>'<span>'+esc(incomeSources.find(o=>o[0]===k)?.[en?2:1]||k)+'<button type="button" data-remove-source="'+esc(k)+'" aria-label="'+t('Quitar ','Remove ')+esc(incomeSources.find(o=>o[0]===k)?.[en?2:1]||k)+'">×</button></span>').join('')+'</div>'+(selected.includes('other')?'<label data-error-key="incomeOther">'+t('Especifique las otras fuentes (una por línea)','Specify other sources (one per line)')+' *<textarea rows="2" data-field="incomeOther" maxlength="2000">'+esc(s.incomeOther||'')+'</textarea></label>':'')+'<details '+(s.funds?'open':'')+'><summary>'+t('Agregar detalle (opcional)','Add detail (optional)')+'</summary><label>'+t('Aclaración sobre las fuentes seleccionadas','Clarification about selected sources')+'<textarea data-field="funds" rows="2" maxlength="2000">'+esc(s.funds||'')+'</textarea></label></details></div>';
}
export function bindSources(root,answers,onChange,lang='es'){
 if(!root.querySelector('#kyc-source-select'))return;
 bindSearchableSelect(root,'kyc-source-select',{options:(_v,q)=>sourceOptions(answers(),q,lang),display:()=>lang==='en'?'Select one or more sources':'Seleccione una o varias fuentes',lang});
 root.querySelector('#kyc-source-select').addEventListener('change',e=>{const key=e.target.value;if(!key)return;onChange(false);const a=answers(),selected=parseList(a.incomeSources);if(!selected.includes(key))selected.push(key);a.incomeSources=JSON.stringify(selected);onChange(true,true);});
 root.querySelectorAll('[data-remove-source]').forEach(b=>b.onclick=()=>{onChange(false);const a=answers();a.incomeSources=JSON.stringify(parseList(a.incomeSources).filter(k=>k!==b.dataset.removeSource));if(b.dataset.removeSource==='other')a.incomeOther='';onChange(true,true);root.querySelector('#kyc-source-select-trigger')?.focus();});
}
