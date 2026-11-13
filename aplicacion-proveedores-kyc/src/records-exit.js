// Native dialog traps focus; Escape and cancel leave the editor untouched.
export function chooseDraftExit(lang='es'){
 const t=(es,en)=>lang==='es'?es:en;
 return new Promise(resolve=>{
  const previous=document.activeElement,dialog=document.createElement('dialog');
  dialog.className='records-exit';dialog.setAttribute('aria-labelledby','records-exit-title');
  dialog.innerHTML=`<h2 id="records-exit-title">${t('Cambios sin guardar','Unsaved changes')}</h2><p>${t('¿Qué desea hacer con este borrador antes de salir?','What would you like to do with this draft before leaving?')}</p><div class="records-actions"><button type="button" class="primary" data-choice="save">${t('Guardar y salir','Save and leave')}</button><button type="button" class="secondary" data-choice="discard">${t('Salir sin guardar','Leave without saving')}</button><button type="button" class="secondary" data-choice="stay" autofocus>${t('Seguir editando','Keep editing')}</button></div>`;
  const finish=value=>{dialog.close();dialog.remove();previous?.focus();resolve(value);};
  dialog.addEventListener('cancel',e=>{e.preventDefault();finish('stay');});
  dialog.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>finish(b.dataset.choice));
  document.body.append(dialog);dialog.showModal();
 });
}
