import {createKycModule} from './kyc-ui.js';
import {provinces,galapagosCantons,identityTypes,emailLabels} from './supplier-options.js';
import './app.css';
import './glf-theme.css';
import {exportCriteria} from './export-context.js';
import {prepareSupplierImage} from './supplier-image.js';
import {messages} from './i18n.js';
import {authErrorKey} from './identity.js';
let mfaPending=false;
import {createStore,demoProfiles} from './store.js';
import {can,canChangeScope,emptySupplier,normalize,normalizeSupplier,validateSupplier,searchSuppliers} from './domain.js';

const store=createStore(__CONFIG__),root=document.querySelector('#app'),modal=document.querySelector('#modal');
let lang=localStorage.getItem('glf-language')==='en'?'en':'es',profile=null,data={suppliers:[],specialties:[]},view='directory',record=null,draft=null,dirty=false,busy=false,page=1,actor='dani',error='',history=[],loadSequence=0;
const kyc=createKycModule(__CONFIG__,store,__LOGO__);
const canKyc=()=>profile&&((store.demo&&['demo-carolina','demo-monica'].includes(profile.id))||profile.kyc_role==='manager'||profile.kyc_role==='delegate'&&Date.parse(profile.kyc_until)>Date.now());
let pendingImage=null,pendingImageUrl=null,imageWarning=false;
const imageCache=new Map();
const filters={q:'',scope:'',specialty:'',offer:'',city:'',status:'active'};
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=k=>messages[lang][k]||k,button=(action,text,cls='secondary',attr='')=>`<button type="button" class="${cls}" data-action="${action}" ${attr}>${e(text)}</button>`;
const option=(v,label,current)=>`<option value="${e(v)}" ${v===current?'selected':''}>${e(label)}</option>`;
const code=s=>'PRV-'+String(s.code).padStart(5,'0');
const date=v=>new Intl.DateTimeFormat(lang==='es'?'es-EC':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Pacific/Galapagos'}).format(new Date(v));
const badge=s=>`<span class="badge ${s.active?'green':'gray'}">${e(t(s.active?'statusActive':'statusInactive'))}</span>`;
const canCreate=()=>['government','glf'].some(s=>can(profile,'create',s));
function toast(text){const el=document.querySelector('#toast');el.textContent=text;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),4500);}
function message(err){const msg=String(err?.message||err),code=err?.code;if(msg.includes('NO_PROFILE'))return t('noProfile');if(msg.includes('STALE'))return t('stale');if(msg.includes('FORBIDDEN')||code==='42501')return t('forbidden');if(msg.includes('DUPLICATE')||code==='23505')return t('duplicate');if(msg.includes('STORAGE'))return t('storageError');if(msg.includes('INVALID')||code==='23514'||code==='23502')return t('invalid');return t('error');}
function header(){
 const identity=profile?'<div class="header-identity" tabindex="0" aria-label="'+e(t('signedInAccount')+': '+profile.display_name+' · '+(profile.email||t('localActor')))+'"><span class="header-identity-email">'+e(profile.email||t('localActor'))+'</span><span class="header-identity-tooltip" aria-hidden="true">'+e(profile.display_name)+'<br>'+e(profile.email||t('localActor'))+'</span></div>':'';
 const languages='<div class="language-switch" role="group" aria-label="Idioma / Language">'+['es','en'].map(l=>'<button type="button" data-language="'+l+'" aria-pressed="'+(lang===l)+'" aria-label="'+(l==='es'?'Español':'English')+'">'+l.toUpperCase()+'</button>').join('')+'</div>';
 const navigation=profile?'<nav aria-label="'+e(lang==='es'?'Navegación principal':'Main navigation')+'"><button type="button" data-action="directory" aria-current="'+(view==='kyc'?'false':'page')+'">'+e(t('suppliers'))+'</button>'+(canKyc()?'<button type="button" data-action="kyc" aria-current="'+(view==='kyc'?'page':'false')+'">KYC</button>':'<span class="future-module" aria-disabled="true">KYC</span>')+'</nav>':'<span class="header-app-title">'+e(t('app'))+'</span>';
 return '<a class="skip-link" href="#main-content">'+e(t('skipContent'))+'</a><header class="live-header"><div class="header-brand-account"><div class="live-brand"><img src="'+__LOGO__+'" width="165" height="71" alt="Galápagos Life Fund"></div>'+identity+'</div>'+navigation+'<div class="header-account-controls">'+languages+(profile&&!store.demo?button('logout',t('signout'),'header-sign-out'):'')+'</div></header>'+(store.demo?'<aside class="demo-banner">'+e(t('demo'))+(profile?'<label>'+e(t('role'))+'<select id="actor" aria-label="'+e(t('demoRoleLabel'))+'">'+Object.entries(demoProfiles).map(([id,p])=>option(id,p.display_name,actor)).join('')+'</select></label>':'')+'</aside>':'<aside class="trial-banner">'+e(t('trial'))+'</aside>');
}
function render(){document.documentElement.lang=lang;document.title='GLF · '+t('app');root.innerHTML=header()+`<main class="live-main" id="main-content">${profile?'<p class="eyebrow">'+e(t('internalModule')+' · '+profile.display_name)+'</p>':''}${profile?(view==='directory'?directory():view==='detail'?detail():view==='kyc'?'<div id="kyc-module"></div>':editor()):login()}</main><footer class="live-footer">Galápagos Life Fund · ${e(t('footer'))}</footer>`;root.querySelectorAll('[data-language]').forEach(el=>el.addEventListener('click',()=>{if(busy||lang===el.dataset.language)return;if(view==='edit')collect();lang=el.dataset.language;localStorage.setItem('glf-language',lang);render();}));root.querySelector('#actor')?.addEventListener('change',async ev=>{const next=ev.target.value;if(!leave()){ev.target.value=actor;return;}kyc.reset();actor=next;store.setActor(actor);profile=await store.profile();view='directory';await reload();});root.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>act(el.dataset.action,el.dataset.id)));if(view==='directory'&&profile)bindFilters();if(view==='edit'&&profile)bindEditor();if(view==='kyc'&&profile)kyc.mount(root.querySelector('#kyc-module'),lang,data.suppliers,profile);root.querySelector('#login-form')?.addEventListener('submit',signin);root.querySelector('#mfa-form')?.addEventListener('submit',verifyMfa);hydrateImages();}
function passwordVisibilityLabel(visible){return lang==='es'?(visible?'Ocultar contraseña':'Mostrar contraseña'):(visible?'Hide password':'Show password');}
function passwordEye(visible){return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>${visible?'<path d="m3 3 18 18"/>':''}</svg>`;}
root.addEventListener('click',ev=>{const toggle=ev.target.closest('#password-visibility');if(!toggle)return;const input=root.querySelector('#login-password'),visible=input.type==='password';input.type=visible?'text':'password';toggle.setAttribute('aria-label',passwordVisibilityLabel(visible));toggle.title=passwordVisibilityLabel(visible);toggle.innerHTML=passwordEye(visible);});
function login(){if(mfaPending)return mfaForm();return `<section class="login panel"><h1>${e(t('signin'))}</h1><p>${e(t('signinHelp'))}</p>${error?`<p role="alert" class="error">${e(error)}</p>`:''}<form id="login-form"><label>${e(t('email'))}<input name="email" type="email" autocomplete="username" required maxlength="250"></label><div class="password-field"><label for="login-password">${e(t('password'))}</label><div class="password-control"><input id="login-password" name="password" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required><button id="password-visibility" type="button" class="password-toggle" aria-controls="login-password" aria-label="${e(passwordVisibilityLabel(false))}" title="${e(passwordVisibilityLabel(false))}">${passwordEye(false)}</button></div></div><button class="primary" ${busy?'disabled':''}>${e(t(busy?'loading':'signin'))}</button></form>${error===t('noProfile')?button('logout',t('signout')):''}</section>`;}
function loginFailure(err){profile=null;mfaPending=String(err?.message).includes('MFA_REQUIRED');error=t(authErrorKey(err));}
function mfaForm(){return `<section class="login panel"><h1>${e(t('mfaTitle'))}</h1><p>${e(t('mfaHelp'))}</p>${error&&error!==t('mfaHelp')?`<p role="alert" class="error">${e(error)}</p>`:''}<form id="mfa-form"><label>${e(t('mfaCode'))}<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required autofocus></label><button class="primary" ${busy?'disabled':''}>${e(t(busy?'loading':'confirm'))}</button></form>${button('logout',t('signout'),'quiet')}</section>`;}
async function signin(ev){ev.preventDefault();if(busy)return;busy=true;const fields=new FormData(ev.target);ev.submitter.disabled=true;ev.target.setAttribute('aria-busy','true');ev.submitter.textContent=t('loading');try{await store.signIn(fields.get('email'),fields.get('password'));profile=await store.profile();if(!profile)throw Error('SESSION_MISSING');mfaPending=false;error='';await reload();}catch(err){loginFailure(err);}finally{busy=false;render();}}
async function verifyMfa(ev){ev.preventDefault();if(busy)return;busy=true;ev.submitter.disabled=true;ev.target.setAttribute('aria-busy','true');ev.submitter.textContent=t('loading');try{await store.verifyMfa(new FormData(ev.target).get('code'));profile=await store.profile();if(!profile)throw Error('SESSION_MISSING');mfaPending=false;error='';await reload();}catch(err){error=t(authErrorKey(err));if(String(err?.message).includes('MFA_SETUP_REQUIRED'))mfaPending=false;}finally{busy=false;render();}}
async function reload(){const seq=++loadSequence;try{const fresh=await store.load();if(seq!==loadSequence)return;data=fresh;error='';if(record){record=data.suppliers.find(s=>s.id===record.id)||null;if(!record)view='directory';}render();}catch(err){if(seq!==loadSequence)return;data={suppliers:[],specialties:[]};error=message(err);view='directory';render();}}
function heading(title,desc,actions='',supplier=null){const content=`<div><h1>${e(title)}</h1><p>${e(desc)}</p></div><div class="actions">${actions}</div>`;return supplier?`<section class="module-heading supplier-heading"><div class="supplier-heading-content">${content}</div>${imageProfile(supplier)}</section>`:`<section class="module-heading">${content}</section>`;}
function filterSelect(id,label,values,current){return `<label>${e(label)}<select id="${id}">${values.map(([v,n])=>option(v,n,current)).join('')}</select></label>`;}
function locationOptions(){
 const locations=new Map();
 for(const value of [...data.suppliers.map(s=>s.city),filters.city]){const label=String(value||'').trim();const key=normalize(label);if(key&&!locations.has(key))locations.set(key,label);}
 return [...locations.values()].sort((a,b)=>a.localeCompare(b,lang,{sensitivity:'base'})).map(label=>[label,label]);
}
function directory(){const specialties=[...data.specialties].sort((a,b)=>a.name.localeCompare(b.name));return heading(t('directory'),t('intro'),button('export',t('download'),'secondary',`title="${e(t('exportHelp'))}"`)+(canCreate()?button('new',t('new'),'primary'):''))+`${error?`<p role="alert" class="error">${e(error)}</p>`:''}<section class="panel filters"><div class="search"><div class="search-heading"><label for="search">${e(t('search'))}</label>${frequent()}</div><input id="search" type="search" value="${e(filters.q)}" placeholder="${lang==='es'?'Ej.: equipos, transporte, consultoría…':'E.g. equipment, transport, consulting…'}"></div><div class="filter-grid">${filterSelect('filter-specialty',t('specialty_ids'),[['',t('allSpecialties')],...specialties.map(s=>[s.id,s.name])],filters.specialty)}${filterSelect('filter-scope',t('scope'),[['',t('allScopes')],['government',t('government')],['glf',t('glf')],['shared',t('shared')]],filters.scope)}${filterSelect('filter-offer',t('offer_type'),[['',t('allOffers')],['goods',t('goods')],['services',t('services')]],filters.offer)}${filterSelect('filter-city',t('location'),[['',t('allLocations')],...locationOptions()],filters.city)}${filterSelect('filter-status',t('state'),['active','inactive','all'].map(s=>[s,t(s)]),filters.status)}</div><div class="filter-bottom"><div class="actions">${button('clear',t('clear'),'secondary')}</div><span>${e(t('directoryNote'))}</span></div></section><section class="panel results" id="results">${results()}</section>`;}
function frequent(){const specs=data.specialties.filter(s=>s.view_count>0).sort((a,b)=>b.view_count-a.view_count).slice(0,5);if(!specs.length)return '';return `<details class="search-frequent"><summary>${e(t('frequent'))}</summary><div class="search-frequent-options">${specs.map(s=>button('specialty',s.name,'chip',`data-id="${e(s.id)}"`)).join('')}</div></details>`;}
function results(){const rows=searchSuppliers(data.suppliers,data.specialties,filters),pages=Math.max(1,Math.ceil(rows.length/12));page=Math.min(page,pages);return `<div class="results-head compact-results-head"><strong class="filtered-result-count">${rows.length} ${e(t(rows.length===1?'result':'results'))}</strong><div class="directory-totals" aria-label="${e(t('directoryTotals'))}" title="${e(t('directoryTotalsHelp'))}"><span class="active-total">${data.suppliers.filter(s=>s.active).length} ${e(t('activeTotalLabel'))}</span><span class="specialties-total">${data.specialties.length} ${e(t('specialtyCount'))}</span></div></div>${rows.length?`<div class="table-wrap"><table><thead><tr>${['name','offer','contact','state','open'].map(k=>`<th>${e(t(k))}</th>`).join('')}</tr></thead><tbody>${rows.slice((page-1)*12,page*12).map(s=>`<tr><td><div class="supplier-name-image">${avatar(s)}<strong>${e(s.legal_name)}</strong></div><small>${e(code(s))} · ${e(t(s.scope))}</small><small>${e(s.city)}, ${e(s.country_name)}</small></td><td>${s.specialty_ids.map(id=>`<span class="tag">${e(data.specialties.find(x=>x.id===id)?.name||'')}</span>`).join('')}<small>${e(t(s.offer_type))}</small></td><td><span>${e(s.email)}</span><small>${e(s.phone)}</small></td><td>${badge(s)}</td><td>${button('open',t('open'),'secondary',`data-id="${e(s.id)}"`)}</td></tr>`).join('')}</tbody></table></div><div class="pagination">${button('previous',t('previous'),'secondary',page===1?'disabled':'')}<span>${page} / ${pages}</span>${button('next',t('next'),'secondary',page===pages?'disabled':'')}</div>`:`<p class="empty">${e(data.suppliers.length?t('noResults'):t('empty'))}</p>`}`;}
function refreshResults(){root.querySelector('#results').innerHTML=results();hydrateImages();root.querySelectorAll('#results [data-action]').forEach(el=>el.addEventListener('click',()=>act(el.dataset.action,el.dataset.id)));}
function bindFilters(){for(const [id,key]of [['search','q'],['filter-city','city'],['filter-specialty','specialty'],['filter-scope','scope'],['filter-offer','offer'],['filter-status','status']]){const el=root.querySelector('#'+id);el.addEventListener(el.tagName==='SELECT'?'change':'input',async()=>{filters[key]=el.value;page=1;refreshResults();if(key==='specialty'&&el.value)try{await store.track(null,el.value);}catch{/* Ranking must not prevent searching. */}});}}
function detail(){if(!record)return '';const s=record;return heading(s.legal_name,code(s)+' · '+t(s.scope),button('directory',t('back'))+(can(profile,'edit',s.scope)?button('edit',t('edit'),'primary'):'')+ (can(profile,'archive',s.scope)?button('status',t(s.active?'deactivate':'reactivate')):''),s)+`${imageWarning?`<p role="alert" class="error">${e(t('imagePartialSave'))}</p>`:''}<div class="detail-grid supplier-detail-grid"><section class="panel supplier-details"><div class="section-title"><h2>${e(t('identification'))}</h2>${badge(s)}</div><dl>${['person_type','id_country_code','id_type','id_number',...(s.tax_number?['tax_number']:[]),'trade_name','country_name','city','province','address',...(s.person_type==='legal'?['legal_rep_name']:[])].map(k=>pair(t(k),['person_type','id_type'].includes(k)?t(s[k]):k==='id_country_code'?new Intl.DisplayNames([lang],{type:'region'}).of(s[k]||s.country_code):s[k])).join('')}</dl><h2>${e(t('commercial'))}</h2><p>${e(t(s.offer_type))}</p><div class="tags">${s.specialty_ids.map(id=>`<span class="tag">${e(data.specialties.find(x=>x.id===id)?.name||'')}</span>`).join('')}</div><p class="prewrap">${e(s.description||t('unknown'))}</p><p>${e(s.keywords)}</p></section><div class="supplier-sidebar"><section class="panel"><h2>${e(t('contactSection'))}</h2><dl>${['contact_name','contact_role','email','phone'].map(k=>pair(t(k),s[k])).join('')}${(s.additional_phones||[]).map((phone,i)=>pair(t('additionalPhone')+' '+(i+1),phone)).join('')}${(s.additional_emails||[]).map(item=>pair(t(item.label),item.email)).join('')}</dl></section><section class="panel supplier-history"><h2>${e(t('history'))}</h2>${history.length?`<ol class="history">${history.map(h=>`<li><strong>${e(t(h.action))}</strong><span>${e(h.actor_name)} · ${e(date(h.created_at))} (Galápagos)</span>${h.reason?`<p>${e(h.reason)}</p>`:''}</li>`).join('')}</ol>`:`<p>${e(t('noHistory'))}</p>`}</section></div></div>`;}
function pair(label,value){return `<div><dt>${e(label)}</dt><dd>${e(value||t('unknown'))}</dd></div>`;}
function field(key,required=false,type='text',help=''){return `<label>${e(t(key))}${required?' *':''}<input name="${key}" id="f-${key}" type="${type}" value="${e(draft[key])}" ${required?'required':''} maxlength="${key==='phone'?50:250}" ${key==='email'?'autocomplete="email"':''}>${help?`<small>${e(help)}</small>`:''}</label>`;}
function selectField(key,values,disabled=false){return `<label>${e(t(key))} *<select name="${key}" id="f-${key}" ${disabled?'disabled':''}>${values.map(([v,n])=>option(v,n,draft[key])).join('')}</select></label>`;}
const countryCodes='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const countryNames=new Intl.DisplayNames(['es'],{type:'region'});
const countries=countryCodes.map(c=>[c,countryNames.of(c)]);
const countryOptions=()=>{const names=new Intl.DisplayNames([lang],{type:'region'});return countryCodes.map(c=>[c,names.of(c)]).sort((a,b)=>a[0]==='EC'?-1:b[0]==='EC'?1:a[1].localeCompare(b[1],lang));};
function editor(){return heading(draft.id?t('edit'):t('new'),t('required')+' *',button('cancel',t('cancel')),draft)+`<form id="supplier-form" novalidate><div id="form-error" role="alert"></div><section class="panel"><h2>1. ${e(t('identification'))}</h2><div class="form-grid">${identityFields()}</div><p class="help">${e(t(draft.id_country_code!=='EC'?'foreignHelp':draft.person_type==='natural'?'naturalHelp':'legalHelp'))}</p></section><section class="panel"><h2>2. ${e(t('commercial'))}</h2><div class="form-grid">${selectField('offer_type',['goods','services','both'].map(s=>[s,t(s)]))}${locationFields()}${field('address')}<label>${e(t('description'))}<textarea name="description" maxlength="2000" rows="3">${e(draft.description)}</textarea></label><label>${e(t('keywords'))}<textarea name="keywords" maxlength="2000" rows="3">${e(draft.keywords)}</textarea></label></div><fieldset id="f-specialty_ids"><legend>${e(t('specialty_ids'))} *</legend><div class="specialty-heading"><p>${e(t('specialtiesHelp'))}</p>${profile.manage_specialties?button('specialty-dialog',t('addSpecialty'),'secondary'):''}</div><div class="specialties">${[...data.specialties].sort((a,b)=>a.name.localeCompare(b.name)).map(s=>`<label><input type="checkbox" name="specialty_ids" value="${e(s.id)}" ${draft.specialty_ids.includes(s.id)?'checked':''}>${e(s.name)}</label>`).join('')}</div></fieldset></section><section class="panel"><h2>3. ${e(t('contactSection'))}</h2><div class="form-grid">${field('email',true,'email')}${field('phone',true,'tel',t('phoneHelp'))}${field('contact_name')}${field('contact_role')}${draft.person_type==='legal'?field('legal_rep_name'):''}</div>${additionalPhones()}${additionalEmails()}</section><div class="sticky-save"><p>${e(t('directoryNote'))}</p><div class="actions">${button('cancel',t('cancel'))}<button class="primary" type="submit" ${busy?'disabled':''}>${e(t(busy?'saving':'save'))}</button></div></div></form>`;}
let duplicateSequence=0,duplicateTimer;
function scopeLabel(value){return t(value==='shared'?'shared':value);}
function scopeOptions(){const original=data.suppliers.find(s=>s.id===draft.id)?.scope||draft.scope;return ['government','glf','shared'].filter(s=>draft.id?canChangeScope(profile,original,s):can(profile,'create',s)).map(s=>[s,scopeLabel(s)]);}
function identityFields(){
 draft.id_country_code||=draft.country_code||'EC';
 const types=identityTypes(draft.person_type,draft.id_country_code);if(!types.includes(draft.id_type))draft.id_type=types[0];
 return `${selectField('scope',scopeOptions())}${selectField('person_type',['natural','legal'].map(s=>[s,t(s)]))}${selectField('id_country_code',countryOptions())}${selectField('id_type',types.map(s=>[s,t(s)]))}${field('id_number',true)}${draft.person_type==='natural'&&draft.id_country_code==='EC'&&draft.id_type==='cedula'?field('tax_number',false,'text',t('taxHelp')):''}<div class="wide" id="duplicate-notice" aria-live="polite"></div>${field('legal_name',true)}${field('trade_name')}`;
}
function locationFields(){
 const customProvince=draft._provinceOther||!!draft.province&&!provinces.includes(draft.province);
 const customCity=draft._cityOther||!!draft.city&&!galapagosCantons.includes(draft.city);
 return selectField('country_code',countryOptions())+(draft.country_code==='EC'?`<label>${e(t('province'))}<select id="province-choice"><option value="">${e(t('selectOption'))}</option>${provinces.map(p=>option(p,p,customProvince?'OTHER':draft.province)).join('')}${option('OTHER',t('other'),customProvince?'OTHER':draft.province)}</select></label>${customProvince?field('province',true):''}`:field('province'))+(draft.country_code==='EC'&&draft.province==='Galápagos'?`<label>${e(t('galapagosCanton'))} *<select id="city-choice"><option value="">${e(t('selectOption'))}</option>${galapagosCantons.map(c=>option(c,c,customCity?'OTHER':draft.city)).join('')}${option('OTHER',t('other'),customCity?'OTHER':draft.city)}</select></label>${customCity?field('city',true):''}`:field('city',true));
}
function additionalPhones(){return `<fieldset id="f-additional_phones"><legend>${e(t('additional_phones'))}</legend><p class="help">${e(t('phonesHelp'))}</p>${(draft.additional_phones||[]).map((phone,i)=>`<div class="extra-phone" data-phone-row><label>${e(t('additionalPhone'))} ${i+1}<input data-phone-address type="tel" maxlength="50" value="${e(phone)}"></label>${button('remove-phone',t('removePhone'),'secondary',`data-id="${i}"`)}</div>`).join('')}${button('add-phone',t('addPhone'),'secondary',(draft.additional_phones||[]).length>=2?'disabled':'')}</fieldset>`;}
function additionalEmails(){return `<fieldset id="f-additional_emails"><legend>${e(t('additional_emails'))}</legend><p class="help">${e(t('emailHelp'))}</p>${(draft.additional_emails||[]).map((item,i)=>`<div class="extra-email" data-email-row><label>${e(t('emailPurpose'))}<select data-email-label>${emailLabels.map(x=>option(x,t(x),item.label)).join('')}</select></label><label>${e(t('email'))}<input data-email-address type="email" maxlength="250" value="${e(item.email)}"></label>${button('remove-email',t('removeEmail'),'secondary',`data-id="${i}"`)}</div>`).join('')}<p id="email-warning" role="status"></p>${button('add-email',t('addEmail'),'secondary',(draft.additional_emails||[]).length>=3?'disabled':'')}</fieldset>`;}
function emailWarning(){const emails=[draft.email,...(draft.additional_emails||[]).map(x=>x.email)].map(x=>String(x||'').trim().toLowerCase()).filter(Boolean);root.querySelector('#email-warning').textContent=new Set(emails).size!==emails.length?t('emailDuplicate'):'';}
async function checkDuplicate(force=false,snapshot=null){
 if(view!=='edit')return false;if(!snapshot)collect();const candidate=snapshot||normalizeSupplier(draft),notice=root.querySelector('#duplicate-notice');if(!notice)return false;
 const identityKey=JSON.stringify([candidate.id,candidate.id_country_code,candidate.id_type,candidate.id_number,candidate.tax_number]);
 if(!force&&notice.dataset.identityKey===identityKey)return notice.dataset.duplicate==='true';const seq=++duplicateSequence;
 const local=candidate.id_country_code==='EC';const valid=local?(candidate.id_type==='ruc'?/^\d{13}$/:/^\d{10}$/).test(candidate.id_number):!!candidate.id_number;
 if(!valid&&!/^\d{13}$/.test(candidate.tax_number)){notice.innerHTML='';delete notice.dataset.identityKey;return false;}
 notice.textContent=t('checkingId');
 try{const ids=await store.findDuplicates(candidate);if(seq!==duplicateSequence||view!=='edit'||!notice.isConnected)return false;
 notice.dataset.identityKey=identityKey;notice.dataset.duplicate=String(ids.length>0);if(!ids.length){notice.textContent=t('idAvailable');return false;}
 if(ids.some(id=>!data.suppliers.some(s=>s.id===id)))data=await store.load();if(seq!==duplicateSequence||!notice.isConnected)return false;
 notice.innerHTML=`<div class="duplicate-card"><strong>${e(t('duplicateTitle'))}</strong><p>${e(t('duplicateHelp'))}</p>${ids.map(id=>{const s=data.suppliers.find(x=>x.id===id);if(!s)return '';return `<div><strong>${e(s.legal_name)}</strong> · ${e(code(s))} · ${badge(s)}<p>${e(s.specialty_ids.map(id=>data.specialties.find(x=>x.id===id)?.name||'').filter(Boolean).join('; '))}</p>${!s.active?`<p>${e(t('duplicateInactive'))}</p>`:''}<div class="actions">${button('duplicate-view',t('viewExisting'),'secondary',`data-id="${e(id)}"`)}${s.active&&can(profile,'edit',s.scope)?button('duplicate-activity',t('addActivity'),'primary',`data-id="${e(id)}"`):''}${button('cancel',t('cancel'))}</div></div>`;}).join('')}</div>`;
 notice.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>act(el.dataset.action,el.dataset.id)));return true;
 }catch{if(seq===duplicateSequence&&notice.isConnected)notice.textContent=t('idCheckFailed');return false;}
}
async function supplierExtraAction(action,id){
 if(action==='add-phone'||action==='remove-phone'){collect();draft.additional_phones||=[];if(action==='add-phone'&&draft.additional_phones.length<2)draft.additional_phones.push('');else if(action==='remove-phone')draft.additional_phones.splice(Number(id),1);dirty=true;render();root.querySelector('[data-phone-row]:last-of-type input')?.focus();return true;}
 if(action==='add-email'||action==='remove-email'){collect();draft.additional_emails||=[];if(action==='add-email'&&draft.additional_emails.length<3)draft.additional_emails.push({label:'contactEmail',email:''});else if(action==='remove-email')draft.additional_emails.splice(Number(id),1);dirty=true;render();root.querySelector('[data-email-row]:last-of-type input')?.focus();return true;}
 if(action==='duplicate-view'||action==='duplicate-activity'){const target=data.suppliers.find(s=>s.id===id);if(!target)return true;dirty=false;clearPendingImage();record=target;if(action==='duplicate-activity'&&target.active&&can(profile,'edit',target.scope)){draft=structuredClone(target);view='edit';render();root.querySelector('#f-specialty_ids').scrollIntoView({block:'center'});root.querySelector('#f-specialty_ids input')?.focus();toast(t('activityHelp'));}else await open(id);return true;}
 return false;
}

function collect(){const form=root.querySelector('#supplier-form');if(!form)return;const fields=new FormData(form);for(const [key,value]of fields)if(key!=='specialty_ids')draft[key]=value;draft.specialty_ids=fields.getAll('specialty_ids');draft.additional_phones=[...form.querySelectorAll('[data-phone-address]')].map(el=>el.value);draft.additional_emails=[...form.querySelectorAll('[data-email-row]')].map(row=>({label:row.querySelector('[data-email-label]').value,email:row.querySelector('[data-email-address]').value}));}
function bindEditor(){
 duplicateSequence++;clearTimeout(duplicateTimer);const form=root.querySelector('#supplier-form');
 form.addEventListener('input',()=>{dirty=true;collect();emailWarning();});
 for(const id of ['person_type','id_country_code','id_type','country_code'])root.querySelector('#f-'+id)?.addEventListener('change',()=>{collect();if(id==='country_code'){draft.country_name=countries.find(([c])=>c===draft.country_code)?.[1]||'';draft._provinceOther=false;draft._cityOther=false;}if(['person_type','id_country_code'].includes(id)){draft.id_type=identityTypes(draft.person_type,draft.id_country_code)[0];draft.tax_number='';}dirty=true;render();checkDuplicate();});
 root.querySelector('#province-choice')?.addEventListener('change',ev=>{collect();draft._provinceOther=ev.target.value==='OTHER';draft.province=draft._provinceOther?'':ev.target.value;draft.city='';draft._cityOther=false;dirty=true;render();});
 root.querySelector('#city-choice')?.addEventListener('change',ev=>{collect();draft._cityOther=ev.target.value==='OTHER';draft.city=draft._cityOther?'':ev.target.value;dirty=true;render();});
 for(const key of ['id_number','tax_number']){const el=root.querySelector('#f-'+key);el?.addEventListener('input',()=>{duplicateSequence++;clearTimeout(duplicateTimer);duplicateTimer=setTimeout(checkDuplicate,400);});el?.addEventListener('blur',()=>{clearTimeout(duplicateTimer);checkDuplicate();});}
 form.addEventListener('submit',save);emailWarning();
}
function leave(){if(busy)return false;if(dirty&&!confirm(t('unsaved')))return false;dirty=false;clearPendingImage();return true;}
async function save(ev){
 ev.preventDefault();if(busy)return;collect();clearTimeout(duplicateTimer);
 const candidate=normalizeSupplier({...draft}),errors=validateSupplier(candidate),form=ev.target;
 if(draft._provinceOther&&!candidate.province)errors.push('province');
 form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
 if(errors.length){
  const labels=[...new Set(errors)].map(key=>t(key));
  form.querySelector('#form-error').innerHTML=`<p class="error">${e(t('invalid'))} ${e(labels.join(', '))}</p>`;
  for(const key of errors){const el=(key==='city'?form.querySelector('#city-choice'):null)||form.querySelector('#f-'+key);el?.setAttribute('aria-invalid','true');if(el?.tagName==='FIELDSET')el.querySelector('input')?.setAttribute('aria-invalid','true');}
  form.querySelector('[aria-invalid] input,[aria-invalid]:not(fieldset)')?.focus();form.querySelector('#form-error').scrollIntoView({block:'center'});return;
 }
 busy=true;const controls=[...form.querySelectorAll('input,select,textarea,button')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);const submit=ev.submitter||form.querySelector('[type=submit]');submit.textContent=t('saving');form.setAttribute('aria-busy','true');
 try{
  if(await checkDuplicate(true,candidate)){root.querySelector('#duplicate-notice')?.scrollIntoView({block:'center'});return;}
  const id=await store.save(candidate);imageWarning=false;
  if(pendingImage){try{await store.setImage({id,version:(candidate.version||0)+1,image_path:null},pendingImage);}catch{imageWarning=true;}finally{clearPendingImage();}}
  draft={...candidate,id,version:(candidate.version||0)+1};dirty=false;
  try{data=await store.load();record=data.suppliers.find(s=>s.id===id);history=await store.history(id);view=record?'detail':'directory';error='';toast(t('saved'));}
  catch{data={suppliers:[],specialties:[]};record=null;history=[];view='directory';error=t('savedRefreshFailed');}
 }catch(err){form.querySelector('#form-error').innerHTML=`<p class="error">${e(message(err))}</p>`;form.querySelector('#form-error').scrollIntoView({block:'center'});}
 finally{busy=false;form.removeAttribute('aria-busy');if(view!=='edit')render();else{controls.forEach(([el,disabled])=>el.disabled=disabled);submit.textContent=t('save');}}
}
async function open(id){const selected=data.suppliers.find(s=>s.id===id);if(!selected)return;busy=true;try{history=await store.history(id);record=selected;view='detail';render();try{await store.track(id,null);}catch{/* Reading remains available if ranking cannot be stored. */}}catch(err){toast(message(err));}finally{busy=false;}}
function specialtyDialog(){
 if(!profile.manage_specialties)return;if(view==='edit')collect();
 modal.innerHTML=`<form id="specialty-form"><h2 id="modal-title">${e(t('addSpecialty'))}</h2><p>${e(t('specialtyDialogHelp'))}</p><label>${e(t('newSpecialty'))}<input id="new-specialty" required minlength="2" maxlength="100" autocomplete="off"></label><p role="alert" id="specialty-error"></p><div class="actions"><button type="button" id="specialty-cancel" class="secondary">${e(t('cancel'))}</button><button type="submit" class="primary">${e(t('addSpecialty'))}</button></div></form>`;
 modal.querySelector('#specialty-cancel').onclick=()=>{if(!busy)modal.close();};
 modal.querySelector('form').onsubmit=async ev=>{ev.preventDefault();if(busy)return;const name=modal.querySelector('#new-specialty').value.trim();if(name.length<2)return;busy=true;ev.submitter.disabled=true;
 try{const existed=data.specialties.some(s=>normalize(s.name)===normalize(name));const saved=await store.addSpecialty(name);data=await store.load();if(view==='edit'){draft.specialty_ids=[...new Set([...draft.specialty_ids,saved.id])];dirty=true;}modal.close();busy=false;render();toast(t(existed?'sameSpecialty':'specialtyAdded'));}
 catch(err){modal.querySelector('#specialty-error').textContent=message(err);}finally{busy=false;ev.submitter.disabled=false;}};
 modal.showModal();modal.querySelector('#new-specialty').focus();
}
function statusDialog(){
 const targetActive=!record.active;
 let reason='',review=false;
 function draw(){
  const effects=targetActive?['reactivateEffect','statusHistoryEffect','statusKycEffect']:['deactivateEffect','statusRetainedEffect','statusRecoverEffect','statusHistoryEffect','statusKycEffect'];
  modal.innerHTML=`<form id="status-form"><h2 id="modal-title">${e(t(review?(targetActive?'reactivateConfirmTitle':'deactivateConfirmTitle'):(targetActive?'reactivate':'deactivate')))}</h2><p><strong>${e(code(record))} · ${e(record.legal_name)}</strong></p>${review?`<div class="status-warning" role="note" aria-label="${e(t('statusConsequences'))}"><h3>${e(t('statusConsequences'))}</h3><ul>${effects.map(key=>`<li>${e(t(key))}</li>`).join('')}</ul></div><p><strong>${e(t('reason'))}:</strong></p><p class="prewrap">${e(reason)}</p>`:`<p>${e(t('statusReviewHelp'))}</p><label>${e(t('reason'))}<textarea name="reason" required minlength="3" maxlength="1000" rows="3">${e(reason)}</textarea></label>`}<p role="alert" id="status-error"></p><div class="actions"><button type="button" id="modal-cancel" class="secondary">${e(t('cancel'))}</button>${review?`<button type="button" id="status-back" class="secondary">${e(t('statusEditReason'))}</button>`:''}<button type="submit" class="primary">${e(t(review?(targetActive?'confirmReactivate':'confirmDeactivate'):'confirm'))}</button></div></form>`;
  modal.querySelector('#modal-cancel').onclick=()=>{if(!busy)modal.close();};
  const back=modal.querySelector('#status-back');
  if(back)back.onclick=()=>{if(!busy){review=false;draw();modal.querySelector('textarea').focus();}};
  modal.querySelector('form').onsubmit=async ev=>{
   ev.preventDefault();if(busy)return;
   if(!review){
    const field=modal.querySelector('textarea');reason=field.value.trim();
    if(reason.length<3){modal.querySelector('#status-error').textContent=t('statusReasonRequired');field.focus();return;}
    review=true;draw();modal.querySelector('#modal-cancel').focus();return;
   }
   busy=true;modal.querySelectorAll('button').forEach(b=>b.disabled=true);ev.submitter.textContent=t('saving');
   try{await store.setActive(record,targetActive,reason);data=await store.load();record=data.suppliers.find(s=>s.id===record.id);history=await store.history(record.id);modal.close();render();toast(t(targetActive?'reactivated':'deactivated'));}
   catch(err){modal.querySelector('#status-error').textContent=message(err);}
   finally{busy=false;modal.querySelectorAll('button').forEach(b=>b.disabled=false);ev.submitter.textContent=t(targetActive?'confirmReactivate':'confirmDeactivate');}
  };
 }
 draw();modal.showModal();
}

modal.addEventListener('cancel',ev=>{if(busy)ev.preventDefault();});
function exportDirectory(){
 const exportData=structuredClone(data),exportFilters={...filters},exportLang=lang;
 const rows=searchSuppliers(exportData.suppliers,exportData.specialties,exportFilters);
 const all=!exportFilters.q&&!exportFilters.scope&&!exportFilters.specialty&&!exportFilters.offer&&!exportFilters.city&&exportFilters.status==='all';
 modal.innerHTML=`<form id="export-form"><h2 id="modal-title">${e(t('download'))}</h2><p class="export-count">${e(t('downloadCount').replace('{count}',rows.length))}</p><p>${e(t(all?'downloadAll':'downloadFiltered'))}</p><div class="status-warning"><h3>${e(t('exportFilters'))}</h3><dl class="export-criteria">${exportCriteria(exportFilters,exportData.specialties,exportLang).map(([name,value])=>pair(name,value)).join('')}</dl></div><p>${e(t('downloadHelp'))}</p><fieldset class="download-formats"><legend>${e(t('downloadFormat'))}</legend><label><input type="radio" name="format" value="xlsx" checked> Excel (.xlsx)</label><label><input type="radio" name="format" value="pdf"> PDF (.pdf)</label></fieldset><p role="alert" id="export-error">${rows.length?'':e(t('exportEmpty'))}</p><div class="actions"><button type="button" id="export-cancel" class="secondary">${e(t('cancel'))}</button><button type="submit" class="primary" ${rows.length?'':'disabled'}>${e(t('downloadConfirm'))}</button></div></form>`;
 modal.querySelector('#export-cancel').onclick=()=>{if(!busy)modal.close();};
 modal.querySelector('form').onsubmit=async ev=>{
  ev.preventDefault();if(busy||!rows.length)return;const format=new FormData(ev.target).get('format');busy=true;modal.querySelectorAll('button,input').forEach(el=>el.disabled=true);ev.submitter.textContent=t('exporting');
  try{let count;if(format==='pdf'){const {downloadSupplierPdf}=await import('./supplier-pdf.js');count=downloadSupplierPdf(exportData,exportFilters,exportLang,__LOGO__);}else{const {downloadSuppliers}=await import('./supplier-export.js');count=await downloadSuppliers(exportData,exportFilters,exportLang);}modal.close();toast(t('exportReady').replace('{count}',count));}
  catch{modal.querySelector('#export-error').textContent=t('exportError');}
  finally{busy=false;modal.querySelectorAll('button,input').forEach(el=>el.disabled=false);ev.submitter.textContent=t('downloadConfirm');}
 };modal.showModal();
}
function avatar(s,large=false){
 const initials=(s.legal_name||'GLF').split(/\s+/).slice(0,2).map(v=>v[0]).join('').toUpperCase();
 const path=s.image_path,preview=s===draft&&pendingImageUrl;
 return `<span class="supplier-avatar ${large?'large':''}"><span aria-hidden="true">${e(initials)}</span>${preview?`<img src="${e(preview)}" alt="${e(t('supplierImage'))}">`:path?`<img data-image-path="${e(path)}" alt="${e(t('supplierImage'))}" hidden>`:''}</span>`;
}
function imageProfile(s){
 const editable=s.id?can(profile,'edit',s.scope):canCreate();
 const hasImage=!!(s.image_path||(s===draft&&pendingImage));
 const label=t(hasImage?'imageChange':editable?'imageAdd':'imagePlaceholder');
 const camera='<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 6h4l2-3h4l2 3h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></svg>';
 const content=hasImage?avatar(s,true):'<span class="supplier-image-placeholder">'+camera+'<span>'+e(label)+'</span></span>';
 return editable?'<button type="button" class="supplier-profile-image '+(hasImage?'has-image':'')+'" data-action="image" aria-label="'+e(label)+'" aria-haspopup="dialog" title="'+e(label)+'">'+content+(hasImage?'<span class="supplier-image-overlay">'+e(label)+'</span>':'')+'</button>':'<div class="supplier-profile-image readonly" role="img" aria-label="'+e(t('supplierImage'))+'">'+content+'</div>';
}

async function hydrateImages(){
 for(const img of root.querySelectorAll('img[data-image-path]')){
  const path=img.dataset.imagePath;
  try{
   if(!imageCache.has(path))imageCache.set(path,store.image(path).then(blob=>typeof blob==='string'?blob:URL.createObjectURL(blob)).catch(err=>{imageCache.delete(path);throw err;}));
   const url=await imageCache.get(path);if(!profile)return;
   if(img.isConnected){img.onload=()=>{img.hidden=false;};img.src=url;}
  }catch{img.alt=t('imageUnavailable');}
 }
}
function clearPendingImage(){if(pendingImageUrl)URL.revokeObjectURL(pendingImageUrl);pendingImage=null;pendingImageUrl=null;}
function clearImages(){clearPendingImage();for(const value of imageCache.values())value.then(url=>{if(url.startsWith('blob:'))URL.revokeObjectURL(url);}).catch(()=>{});imageCache.clear();}
function imageDialog(){
 if(view==='edit')collect();
 const target=view==='edit'?draft:record;
 let selected=null,selectedUrl=null,remove=false;
 modal.innerHTML=`<form id="image-form"><h2 id="modal-title">${e(t('supplierImage'))}</h2><p>${e(target.legal_name||t('new'))}</p><p>${e(t('imageHelp'))}</p>${!target.id?`<p>${e(t('imageNewHelp'))}</p>`:''}<label>${e(t('imageFile'))}<input id="supplier-image-file" type="file" accept="image/jpeg,image/png,image/webp"></label><div id="image-preview"></div><p role="alert" id="image-error"></p><div class="actions"><button type="button" id="image-cancel" class="secondary">${e(t('cancel'))}</button>${target.image_path||pendingImage?`<button type="button" id="image-remove" class="secondary">${e(t('imageRemove'))}</button>`:''}<button type="submit" id="image-save" class="primary" disabled>${e(t('imageSave'))}</button></div></form>`;
 const cleanup=()=>{if(selectedUrl)URL.revokeObjectURL(selectedUrl);};
 modal.addEventListener('close',cleanup,{once:true});
 modal.querySelector('#image-cancel').onclick=()=>{if(!busy)modal.close();};
 modal.querySelector('#supplier-image-file').onchange=async ev=>{
  const file=ev.target.files[0];if(!file||busy)return;busy=true;ev.target.disabled=true;selected=null;remove=false;cleanup();selectedUrl=null;modal.querySelector('#image-preview').textContent='';modal.querySelector('#image-save').disabled=true;modal.querySelector('#image-error').textContent=t('imageProcessing');
  try{selected=await prepareSupplierImage(file);cleanup();selectedUrl=URL.createObjectURL(selected);modal.querySelector('#image-preview').innerHTML=`<img class="image-preview" src="${e(selectedUrl)}" alt="${e(t('supplierImage'))}"><p>${Math.ceil(selected.size/1024)} KB · ${e(t('imagePrepared'))}</p>`;modal.querySelector('#image-save').disabled=false;modal.querySelector('#image-error').textContent='';}
  catch{modal.querySelector('#image-error').textContent=t('imageInvalid');}
  finally{busy=false;ev.target.disabled=false;}
 };
 modal.querySelector('#image-remove')?.addEventListener('click',()=>{if(busy)return;selected=null;remove=true;cleanup();selectedUrl=null;modal.querySelector('#image-preview').textContent=t('imageRemoveHelp');modal.querySelector('#image-save').disabled=false;modal.querySelector('#image-error').textContent='';});
 modal.querySelector('form').onsubmit=async ev=>{
  ev.preventDefault();if(busy||(!selected&&!remove))return;
  if(!target.id){clearPendingImage();pendingImage=selected;pendingImageUrl=selected?URL.createObjectURL(selected):null;dirty=true;modal.close();render();return;}
  busy=true;modal.querySelectorAll('button,input').forEach(el=>el.disabled=true);
  try{await store.setImage(target,selected);data=await store.load();record=data.suppliers.find(s=>s.id===target.id);history=await store.history(target.id);if(view==='edit'){draft.version=record.version;draft.image_path=record.image_path;}imageWarning=false;modal.close();busy=false;render();toast(t('imageSaved'));}
  catch(err){modal.querySelector('#image-error').textContent=message(err);}
  finally{busy=false;modal.querySelectorAll('button,input').forEach(el=>el.disabled=false);}
 };
 modal.showModal();
}
async function act(action,id){if(busy)return;if(action==='kyc'){if(!canKyc()||!leave())return;view='kyc';render();return;}if(action==='specialty-dialog'){specialtyDialog();return;}if(await supplierExtraAction(action,id))return;if(action==='directory'||action==='cancel'){if(!leave())return;view='directory';await reload();return;}if(action==='new'){clearPendingImage();imageWarning=false;draft=emptySupplier(['government','glf'].find(s=>can(profile,'create',s)));view='edit';dirty=false;render();}else if(action==='edit'){clearPendingImage();draft=structuredClone(record);view='edit';dirty=false;render();}else if(action==='open')await open(id);else if(action==='export')await exportDirectory();else if(action==='clear'){Object.assign(filters,{q:'',scope:'',specialty:'',offer:'',city:'',status:'active'});page=1;render();}else if(action==='previous'||action==='next'){page+=action==='next'?1:-1;refreshResults();}else if(action==='specialty'){filters.specialty=id;page=1;render();try{await store.track(null,id);}catch{}}else if(action==='status')statusDialog();else if(action==='image')imageDialog();else if(action==='logout'){if(!leave())return;busy=true;const control=root.querySelector('[data-action=logout]');if(control){control.disabled=true;control.setAttribute('aria-busy','true');control.innerHTML='<span class=action-spinner aria-hidden=true></span>'+e(t('signingOut'));}try{await store.signOut();kyc.reset();clearImages();profile=null;data={suppliers:[],specialties:[]};record=null;draft=null;history=[];error='';view='directory';render();}catch(err){toast(message(err));}finally{busy=false;render();}}}
window.addEventListener('beforeunload',ev=>{if(dirty){ev.preventDefault();ev.returnValue='';}});
async function boot(){if(kyc.external){await kyc.startExternal(root,lang);return;}try{profile=await store.profile();if(profile)await reload();else render();}catch(err){loginFailure(err);render();}}
if(!store.demo&&!kyc.external)store.client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){kyc.reset();clearImages();mfaPending=false;profile=null;data={suppliers:[],specialties:[]};record=null;draft=null;history=[];dirty=false;view='directory';render();}});
// A different invitation opened in the same tab must initialize its own case.
window.addEventListener('hashchange',event=>{if(new URL(event.newURL).hash.startsWith('#kyc=')||new URL(event.oldURL).hash.startsWith('#kyc='))location.reload();});
await boot();
