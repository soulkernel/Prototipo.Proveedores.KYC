import {createUsersModule} from './users-ui.js';
import {createRecordsModule} from './records-ui.js';
export function createAdministrationModule(store,logo){
 const users=createUsersModule(store),records=createRecordsModule(store,logo);let tab='users',root,lang,profile;
 function draw(){const t=(es,en)=>lang==='es'?es:en;root.innerHTML=`<div class="records-tabs" role="tablist"><button type="button" class="${tab==='users'?'primary':'secondary'}" data-admin-tab="users">${t('Usuarios y accesos','Users and access')}</button><button type="button" class="${tab==='structure'?'primary':'secondary'}" data-admin-tab="structure">${t('Direcciones, sedes y perfiles','Units, sites and roles')}</button></div><div id="administration-body"></div>`;root.querySelectorAll('[data-admin-tab]').forEach(b=>b.onclick=()=>{if(tab==='structure'&&!records.canLeave())return;tab=b.dataset.adminTab;draw();});if(tab==='users')users.mount(root.querySelector('#administration-body'),lang,profile);else records.mount(root.querySelector('#administration-body'),lang,profile,{admin:true});}
 return {canLeave:()=>tab!=='structure'||records.canLeave(),mount(el,language,account){root=el;lang=language;profile=account;draw();},reset(){records.reset();}};
}
