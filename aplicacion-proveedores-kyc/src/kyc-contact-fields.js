import {helpIcon,searchableSelect} from './kyc-compact-controls.js';
import {getCountries,getCountryCallingCode,parsePhoneNumberFromString} from 'libphonenumber-js/min';
import {nationalities} from './nationalities.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const priority=['EC','US','CO','PE','VE','CL','AR','BR','MX','CA'];
const regions=['americas','europe','oceania','asia','africa'];
export const phoneCountries=getCountries();
export function callingCountries(query='',lang='es'){
 const names=new Intl.DisplayNames([lang],{type:'region'}),q=norm(query),rank=c=>priority.includes(c)?priority.indexOf(c):20+regions.indexOf(nationalities.find(n=>n.code===c)?.region||'africa');
 return phoneCountries.map(country=>({country,code:'+'+getCountryCallingCode(country),name:names.of(country)})).filter(n=>!q||norm(n.name+' '+n.country+' '+n.code).includes(q)).sort((a,b)=>rank(a.country)-rank(b.country)||a.name.localeCompare(b.name,lang));
}
// Metadata from libphonenumber-js. International code source: https://www.itu.int/oth/T0202.aspx?parent=T0202
export function splitPhone(value='',preferred='EC'){
 const raw=String(value).trim(),international=raw.replace(/^00/,'+');
 if(!international.startsWith('+'))return {country:phoneCountries.includes(preferred)?preferred:'EC',number:raw};
 const parsed=parsePhoneNumberFromString(international,{extract:false});
 const code=parsed?.countryCallingCode||[...new Set(phoneCountries.map(c=>getCountryCallingCode(c)))].sort((a,b)=>b.length-a.length).find(c=>international.startsWith('+'+c));
 if(!code)return {country:'__legacy',number:raw};
 const matches=callingCountries().filter(n=>n.code==='+'+code),country=parsed?.country||(matches.some(n=>n.country===preferred)?preferred:matches[0]?.country);
 if(!country)return {country:'__legacy',number:raw};
 return {country,number:parsed?parsed.nationalNumber+(parsed.ext?' ext. '+parsed.ext:''):international.slice(code.length+1).trim()};
}
export function phoneValue(country,number){
 const raw=String(number).trim();if(!raw)return '';
 if(!phoneCountries.includes(country))return raw;
 const international=raw.replace(/^00/,'+'),parsed=parsePhoneNumberFromString(international,{defaultCountry:country,extract:false});
 if(parsed)return '+'+parsed.countryCallingCode+' '+parsed.nationalNumber+(parsed.ext?' ext. '+parsed.ext:'');
 return international.startsWith('+')?international:'+'+getCountryCallingCode(country)+' '+raw;
}
export function phoneOptions(selected='EC',query='',lang='es'){
 const rows=callingCountries(query,lang),all=callingCountries('',lang),option=n=>'<option value="'+n.country+'" '+(n.country===selected?'selected':'')+'>'+esc(n.name+' ('+n.code+')')+'</option>';
 let html=rows.map(option).join('');
 if(!rows.some(n=>n.country===selected)){const current=all.find(n=>n.country===selected);if(current)html+='<optgroup label="'+(lang==='en'?'Current selection':'Selección actual')+'">'+option(current)+'</optgroup>';}
 if(selected==='__legacy')html+='<option value="__legacy" selected>'+(lang==='en'?'Select country — previous number preserved':'Seleccione país — número anterior conservado')+'</option>';
 return {html,count:rows.length};
}
export function phoneField(value='',lang='es',preferred='EC'){
 const t=(es,en)=>lang==='en'?en:es,s=splitPhone(value,preferred),code=callingCountries().find(n=>n.country===s.country)?.code||'—';
 return '<div class="kyc-phone" data-error-key="phone" data-original="'+esc(value)+'" data-initial-country="'+s.country+'" data-initial-number="'+esc(s.number)+'"><div class="kyc-phone-row"><div class="kyc-phone-code"><label for="kyc-phone-country-trigger">'+t('Código de país','Country code')+'</label>'+searchableSelect('kyc-phone-country',t('Código de país','Country code'),phoneOptions(s.country,'',lang).html,code,lang)+'</div><div class="kyc-phone-local"><div class="kyc-field-title"><label for="kyc-phone-number">'+t('Teléfono principal','Primary phone')+' *</label>'+helpIcon('kyc-phone-help',t('Ayuda sobre teléfono','Phone help'),t('Seleccione el código del teléfono, aunque sea distinto de su nacionalidad o domicilio. También puede pegar un número internacional completo.','Select the phone calling code, even if different from your nationality or residence. You can also paste a full international number.'))+'</div><input id="kyc-phone-number" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="50" value="'+esc(s.number)+'" placeholder="'+t('Número de teléfono','Phone number')+'"></div></div></div>';
}
export function readPhoneField(root){
 const box=root.querySelector('.kyc-phone');if(!box)return undefined;
 const country=box.querySelector('#kyc-phone-country').value,number=box.querySelector('#kyc-phone-number').value;
 return country===box.dataset.initialCountry&&number===box.dataset.initialNumber?box.dataset.original:phoneValue(country,number);
}
export const galapagosCities=['Puerto Ayora','Puerto Baquerizo Moreno','Puerto Villamil','Puerto Velasco Ibarra'];
export const mainlandCities=['Quito','Guayaquil','Cuenca','Santo Domingo','Machala','Manta','Portoviejo','Ambato','Loja','Riobamba','Ibarra','Esmeraldas','Quevedo','Durán','Milagro','Latacunga','Tulcán','Babahoyo','Azogues','Guaranda','Santa Elena','Salinas','La Libertad','Tena','Puyo','Macas','Zamora','Nueva Loja','Puerto Francisco de Orellana'];
export const residenceCities=[...galapagosCities,...mainlandCities];
export function cityField(value='',lang='es',forceOther=false){
 const t=(es,en)=>lang==='en'?en:es,other=forceOther||!!value&&!residenceCities.includes(value),option=c=>'<option value="'+esc(c)+'" '+(!other&&value===c?'selected':'')+'>'+esc(c)+'</option>';
 return '<div class="kyc-city" data-error-key="city"><label for="kyc-city-select">'+t('Ciudad de domicilio','City of residence')+' *<select id="kyc-city-select"><option value="">'+t('Seleccione ciudad','Select city')+'</option><optgroup label="Galápagos">'+galapagosCities.map(option).join('')+'</optgroup><optgroup label="'+t('Ecuador continental','Mainland Ecuador')+'">'+mainlandCities.map(option).join('')+'</optgroup><option value="__other" '+(other?'selected':'')+'>'+t('Otra ciudad — escribir','Other city — enter name')+'</option></select></label>'+(other?'<label for="kyc-city-other">'+t('Escriba la ciudad de domicilio','Enter city of residence')+' *<input id="kyc-city-other" data-field="city" maxlength="250" autocomplete="address-level2" value="'+esc(value)+'" placeholder="'+t('Ciudad de Ecuador o del extranjero','City in Ecuador or abroad')+'"></label>':'')+'</div>';
}
