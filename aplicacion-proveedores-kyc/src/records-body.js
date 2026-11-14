const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function bodyParagraphs(body='',format=null){
 return String(body).split('\n').map((text,i)=>{const chars=Array.from(text),f=format?.version===1?format.paragraphs?.[i]:null;
  const align=['left','center','justify'].includes(f?.align)?f.align:'justify';
  const bold=(Array.isArray(f?.bold)?f.bold:[]).filter(r=>Array.isArray(r)&&r.length===2&&Number.isInteger(r[0])&&Number.isInteger(r[1])&&r[0]>=0&&r[1]>r[0]&&r[1]<=chars.length);
  const runs=[];for(let j=0;j<chars.length;j++){const b=bold.some(([a,z])=>j>=a&&j<z),last=runs.at(-1);if(last?.bold===b)last.text+=chars[j];else runs.push({text:chars[j],bold:b});}
  return {text,align,runs};
 });
}
export function bodyHtml(body,format){return bodyParagraphs(body,format).map(p=>`<p class="records-align-${p.align}">${p.runs.map(r=>r.bold?'<strong>'+escape(r.text)+'</strong>':escape(r.text)).join('')||'<br>'}</p>`).join('');}
export function readBodyEditor(editor){
 const paragraphs=[];let current=null;
 const begin=align=>current={text:'',align:['left','center','justify'].includes(align)?align:'justify',bold:[]};
 const flush=()=>{if(current){paragraphs.push(current);current=null;}};
 const append=(text,bold,align)=>{for(const [i,part] of String(text).replace(/\r/g,'').split('\n').entries()){if(i)flush();if(!current)begin(align);const start=Array.from(current.text).length;current.text+=part;if(bold&&part){const end=Array.from(current.text).length,last=current.bold.at(-1);if(last?.[1]===start)last[1]=end;else current.bold.push([start,end]);}}};
 const walk=(node,bold=false,align='justify')=>{
  if(node.nodeType===3){append(node.textContent,bold,align);return;}if(node.nodeType!==1)return;
  if(['SCRIPT','STYLE','IFRAME','OBJECT','IMG'].includes(node.tagName))return;
  const block=['P','DIV','LI','H1','H2','H3','H4','BLOCKQUOTE'].includes(node.tagName),a=['left','center','justify'].find(v=>node.classList.contains('records-align-'+v))||node.style.textAlign||align,b=bold||['B','STRONG'].includes(node.tagName)||['bold','700'].includes(node.style.fontWeight);
  if(node.tagName==='BR'){if(node.parentElement.childNodes.length>1)flush();else if(!current)begin(a);return;}
  if(block){if(current?.text)flush();else current=null;begin(a);}
  for(const child of node.childNodes)walk(child,b,a);
  if(block)flush();
 };
 for(const node of editor.childNodes)walk(node);flush();if(!paragraphs.length)begin('justify'),flush();
 return {body:paragraphs.map(p=>p.text).join('\n'),body_format:{version:1,paragraphs:paragraphs.map(({align,bold})=>({align,bold}))}};
}
export function bindBodyEditor(container,onChange){
 const editor=container.querySelector('[data-body-editor]');if(!editor)return;
 let saved=null;
 const remember=()=>{const s=window.getSelection();if(s?.rangeCount&&editor.contains(s.anchorNode)&&editor.contains(s.focusNode))saved=s.getRangeAt(0).cloneRange();};
 const state=()=>{remember();const s=window.getSelection();if(!s||!editor.contains(s.anchorNode))return;let block=s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement;while(block&&block.parentElement!==editor)block=block.parentElement;const align=['left','center','justify'].find(v=>block?.classList.contains('records-align-'+v))||block?.style.textAlign||'justify';for(const b of container.querySelectorAll('[data-body-command]'))b.setAttribute('aria-pressed',String(b.dataset.bodyCommand==='bold'?document.queryCommandState('bold'):b.dataset.align===align));};
 editor.addEventListener('keyup',state);editor.addEventListener('mouseup',state);editor.addEventListener('focus',state);
 editor.addEventListener('input',()=>{onChange();state();});
 editor.addEventListener('paste',ev=>{ev.preventDefault();document.execCommand('insertText',false,ev.clipboardData.getData('text/plain'));onChange();state();});
 for(const button of container.querySelectorAll('[data-body-command]')){
  button.addEventListener('mousedown',ev=>ev.preventDefault());
  button.addEventListener('click',()=>{editor.focus();const s=window.getSelection();if(saved&&editor.contains(saved.commonAncestorContainer)){s.removeAllRanges();s.addRange(saved);}if(button.dataset.bodyCommand==='bold'){document.execCommand('styleWithCSS',false,false);document.execCommand('bold',false);}
   else{
    let range=s.rangeCount?s.getRangeAt(0):null;
    const points=range?{start:range.startContainer,so:range.startOffset,end:range.endContainer,eo:range.endOffset}:null;
    if(!editor.querySelector('p,div')){const p=document.createElement('p');while(editor.firstChild)p.append(editor.firstChild);editor.append(p);if(points){range=document.createRange();range.setStart(points.start,points.so);range.setEnd(points.end,points.eo);s.removeAllRanges();s.addRange(range);}}
    const blocks=[...editor.querySelectorAll('p,div')].filter(p=>!p.querySelector('p,div'));
    for(const p of blocks)if(!range||range.intersectsNode(p)){p.classList.remove('records-align-left','records-align-center','records-align-justify');p.classList.add('records-align-'+button.dataset.align);p.style.removeProperty('text-align');}
   }onChange();state();});
 }
}
