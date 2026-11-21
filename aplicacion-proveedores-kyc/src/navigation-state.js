// Per-tab navigation only. Never persist forms, credentials, attachments or invitations.
const key='glf-navigation-v1';
const text=v=>typeof v==='string'?v.slice(0,200):'';
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(v)?v:null;
const index=v=>Number.isInteger(v)&&v>=0?Math.min(v,100000):0;
export function cleanNavigation(value){
 if(!value||!['directory','detail','edit','import','kyc','records','users','guide'].includes(value.view))return null;
 const s=value.state||{},f=s.filters||{};
 return {view:value.view,id:id(value.id),page:Math.max(1,index(value.page)),filters:Object.fromEntries(['q','scope','specialty','offer','city','status'].map(k=>[k,text(value.filters?.[k])])),state:{mode:text(s.mode),screen:text(s.screen),id:id(s.id),direction:s.direction==='outgoing'?'outgoing':'incoming',view:text(s.view),q:text(s.q),status:text(s.status),offset:index(s.offset),step:Math.min(index(s.step),5),tab:text(s.tab),adminTab:text(s.adminTab),filters:Object.fromEntries(['date_from','date_to','person_id','signer_id','deadline'].map(k=>[k,text(f[k])]))}};
}
export function saveNavigation(storage,user,value){try{const state=cleanNavigation(value);if(user&&state)storage.setItem(key,JSON.stringify({user,state}));}catch{/* Storage may be unavailable; navigation remains usable. */}}
export function readNavigation(storage,user){try{const raw=storage.getItem(key);if(!raw||raw.length>6000)return null;const value=JSON.parse(raw);return value.user===user?cleanNavigation(value.state):null;}catch{return null;}}
export function clearNavigation(storage){try{storage.removeItem(key);}catch{}}
