import './app.css';
import './glf-theme.css';
import {externalManual} from './manual-external-data.js';
import {manualHtml,bindManual} from './manual-ui.js';
const root=document.querySelector('#app');
let lang=new URLSearchParams(location.search).get('lang')==='en'?'en':'es';
function render(){document.documentElement.lang=lang;document.title=externalManual.title[lang==='en'?1:0]+' · GLF';root.innerHTML=`<header class="live-header"><img src="${__LOGO__}" width="165" alt="Galápagos Life Fund"><span class="manual-external-brand">${lang==='es'?'Ayuda del formulario KYC':'KYC form help'}</span><div class="language-switch"><button type="button" data-language="es" aria-pressed="${lang==='es'}">ES</button><button type="button" data-language="en" aria-pressed="${lang==='en'}">EN</button></div></header><main class="manual-only">${manualHtml(externalManual,lang)}</main><footer class="live-footer">Galápagos Life Fund</footer>`;bindManual(root,externalManual,lang);root.querySelectorAll('[data-language]').forEach(b=>b.onclick=()=>{lang=b.dataset.language;const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);render();});const id=location.hash.slice(1);if(/^manual-[a-z-]+$/.test(id))requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView());}
render();
