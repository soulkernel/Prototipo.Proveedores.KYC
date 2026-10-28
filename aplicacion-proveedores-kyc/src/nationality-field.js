import {nationalityOptions,nationalityGroups,resolveNationality} from './nationalities.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tr=(lang,es,en)=>lang==='en'?en:es;
export function nationalitySelectOptions(value='',query='',lang='es'){
 const selected=resolveNationality(value),canonical=selected?.es||value,rows=nationalityOptions(query,lang),names=new Intl.DisplayNames([lang],{type:'region'});
 const option=n=>'<option value="'+esc(n.es)+'" '+(canonical===n.es?'selected':'')+'>'+esc(n[lang==='en'?'en':'es']+' · '+names.of(n.code))+'</option>';
 let html='<option value="">'+tr(lang,'Seleccione nacionalidad','Select nationality')+'</option>';
 for(const group of Object.keys(nationalityGroups)){
  const items=rows.filter(n=>n.group===group);if(items.length)html+='<optgroup label="'+esc(nationalityGroups[group][lang==='en'?1:0])+'">'+items.map(option).join('')+'</optgroup>';
 }
 // Filtering never clears a choice or discards a legacy value from a saved draft.
 if(selected&&!rows.some(n=>n.code===selected.code))html+='<optgroup label="'+tr(lang,'Selección actual','Current selection')+'">'+option(selected)+'</optgroup>';
 if(value&&!selected)html+='<option selected disabled value="'+esc(value)+'">'+esc(tr(lang,'Valor anterior: ','Previous value: ')+value)+'</option>';
 return {html,count:rows.length};
}
export function nationalityField(value='',lang='es'){
 const t=(es,en)=>tr(lang,es,en),legacy=value&&!resolveNationality(value);
 return '<div class="kyc-nationality" data-error-key="nationality"><label for="kyc-nationality-search">'+t('Buscar nacionalidad','Search nationalities')+'</label><input id="kyc-nationality-search" type="search" placeholder="'+t('Nacionalidad o país, por ejemplo: Ecuador','Nationality or country, e.g. Ecuador')+'" aria-controls="kyc-nationality-select"><label for="kyc-nationality-select">'+t('Nacionalidad','Nationality')+' *</label><select id="kyc-nationality-select" data-field="nationality">'+nationalitySelectOptions(value,'',lang).html+'</select><small>'+t('Seleccione una opción del listado. La nacionalidad es independiente del país de residencia.','Select a listed option. Nationality is independent of your country of residence.')+'</small>'+(legacy?'<small>'+t('Se conserva el valor anterior. Seleccione una opción del catálogo para uniformarlo.','The previous value is preserved. Select a catalog option to standardize it.')+'</small>':'')+'<small id="kyc-nationality-results" role="status"></small></div>';
}

