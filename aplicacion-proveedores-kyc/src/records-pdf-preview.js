import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
GlobalWorkerOptions.workerSrc=__PDF_WORKER_URL__;

// Render authenticated bytes locally; never upload them or alter the signed PDF.
export async function renderPdfPreview(host,blob,lang='es'){
 const t=(es,en)=>lang==='es'?es:en;
 host.innerHTML='<div class="records-preview-pages"><button type="button" data-prev disabled>'+t('Página anterior','Previous page')+'</button><span role="status">'+t('Cargando PDF…','Loading PDF…')+'</span><button type="button" data-next disabled>'+t('Página siguiente','Next page')+'</button></div><div class="records-preview-sheet"><canvas role="img"></canvas></div>';
 const canvas=host.querySelector('canvas'),previous=host.querySelector('[data-prev]'),next=host.querySelector('[data-next]'),status=host.querySelector('[role=status]');
 let pageNumber=1,closed=false,renderTask=null;
 const loading=getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,wasmUrl:'/pdf-assets/wasm/',cMapUrl:'/pdf-assets/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf-assets/standard_fonts/'});
 const stop=()=>{closed=true;renderTask?.cancel();loading.destroy().catch(()=>{});};
 const dialog=host.closest('dialog');dialog?.addEventListener('close',stop,{once:true});
 try{
  const pdf=await loading.promise;
  async function render(){
   if(closed)return;previous.disabled=true;next.disabled=true;
   status.textContent=t('Cargando página…','Loading page…');
   const page=await pdf.getPage(pageNumber);if(closed)return;
   const unit=page.getViewport({scale:1});const width=Math.max(240,Math.min(1000,host.clientWidth-28));
   const scale=Math.min(2,window.devicePixelRatio||1)*width/unit.width;
   const viewport=page.getViewport({scale});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   canvas.setAttribute('aria-label',t('Página ','Page ')+pageNumber+t(' de ',' of ')+pdf.numPages);
   renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;if(closed)return;
   status.textContent=t('Página ','Page ')+pageNumber+' / '+pdf.numPages;canvas.dataset.ready='true';
   previous.disabled=pageNumber<=1;next.disabled=pageNumber>=pdf.numPages;
  }
  const turn=async delta=>{pageNumber+=delta;try{await render();}catch{if(!closed)status.textContent=t('No se pudo mostrar la página. Descargue el PDF.','Unable to display the page. Download the PDF.');}};
  previous.onclick=()=>turn(-1);next.onclick=()=>turn(1);await render();
 }catch(e){if(!closed){status.textContent=t('No se pudo mostrar la vista previa. Puede descargar el PDF.','Unable to display the preview. You can download the PDF.');canvas.hidden=true;}if(!closed)throw e;}
}
