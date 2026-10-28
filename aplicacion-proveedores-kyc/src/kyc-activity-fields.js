import {activityCatalog} from './activity-catalog.js';
import {searchableSelect,helpIcon} from './kyc-compact-controls.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function splitActivities(value=''){
 const lines=String(value).split('\n'),selected=[],other=[];
 for(const line of lines){if(activityCatalog.some(r=>r.es===line)){if(!selected.includes(line))selected.push(line);}else other.push(line);}
 return {selected,other:other.join('\n')};
}
export function joinActivities(selected,other=''){return [...new Set(selected),String(other).trim()].filter(Boolean).join('\n');}
export function activityLabel(value,lang='es'){if(lang!=='en')return value;return String(value).split('\n').map(line=>activityCatalog.find(r=>r.es===line)?.en||line).join('\n');}
export function activityOptions(value='',query='',lang='es'){
 const s=splitActivities(value),q=norm(query),rows=activityCatalog.filter(r=>!q||norm(r.es+' '+r.en).includes(q));
 const html='<option value="">'+(lang==='en'?'Select an option':'Seleccione una opción')+'</option>'+rows.map(r=>'<option value="'+esc(r.es)+'" '+(s.selected.includes(r.es)||joinActivities([...s.selected,r.es],s.other).length>2000?'disabled':'')+'>'+esc(lang==='en'?r.en:r.es)+'</option>').join('')+'<option value="__other">'+(lang==='en'?'Other / Not listed — describe':'Otra / No está en la lista — especificar')+'</option>';
 return {html,count:rows.length};
}
export function activityField(key,value='',lang='es',showOther=false){
 const t=(es,en)=>lang==='en'?en:es,s=splitActivities(value),label=key==='activity'?t('Actividad económica o profesional','Economic or professional activity'):t('Bienes o servicios que prestará al GLF','Goods or services you will provide to GLF'),id='kyc-'+key+'-choice',custom=showOther||!!s.other;
 return '<div class="kyc-activity-choice" data-error-key="'+key+'" data-choice-key="'+key+'" data-original="'+esc(value)+'" data-initial="'+esc(joinActivities(s.selected,s.other))+'"><div class="kyc-field-title"><label for="'+id+'-trigger">'+label+' *</label>'+helpIcon(id+'-help',t('Ayuda: ','Help: ')+label,key==='activity'?t('Seleccione una o varias actividades que realiza. Use Otra para describir una actividad que no figure en el listado.','Select one or more activities you perform. Use Other to describe an activity not listed.'):t('Seleccione únicamente los bienes o servicios que entregará al GLF. Puede agregar varias opciones o especificar otra.','Select only the goods or services you will provide to GLF. You can add several options or describe another.'))+'</div>'+searchableSelect(id,label,activityOptions(value,'',lang).html,t('Seleccione una o varias opciones','Select one or more options'),lang)+'<div class="kyc-choice-tags">'+s.selected.map(v=>'<span data-selected-choice="'+esc(v)+'">'+esc(activityLabel(v,lang))+'<button type="button" data-remove-choice="'+esc(v)+'" aria-label="'+esc(t('Quitar ','Remove ')+activityLabel(v,lang))+'">×</button></span>').join('')+'</div>'+(custom?'<label>'+(key==='activity'?t('Otra actividad o detalle adicional','Other activity or additional detail'):t('Otro bien o servicio, o detalle adicional','Other goods or services, or additional detail'))+'<textarea id="kyc-'+key+'-other" data-other-choice rows="2" maxlength="'+Math.max(0,2000-joinActivities(s.selected).length-(s.selected.length?1:0))+'" placeholder="'+t('Especifique lo que no aparece en la lista','Describe what is not listed')+'">'+esc(s.other)+'</textarea></label>':'')+'</div>';
}
export function readActivityField(root,key){
 const box=root.querySelector('[data-choice-key="'+key+'"]');if(!box)return undefined;
 const value=joinActivities([...box.querySelectorAll('[data-selected-choice]')].map(el=>el.dataset.selectedChoice),box.querySelector('[data-other-choice]')?.value||'');
 return value===box.dataset.initial?box.dataset.original:value;
}

