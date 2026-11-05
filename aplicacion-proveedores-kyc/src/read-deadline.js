// Bound read operations without retrying writes or accepting late results.
export function readWithDeadline(read,ms=15000){
 const controller=new AbortController();let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{const error=new Error('READ_TIMEOUT');controller.abort(error);reject(error);},ms);});
 return Promise.race([Promise.resolve().then(()=>read(controller.signal)),timeout]).finally(()=>clearTimeout(timer));
}
export function readSignal(query,signal){signal?.throwIfAborted();return signal?query.abortSignal(signal):query;}
// Auth getUser does not accept a signal. Bound its GET transport so a stalled
// read cannot hold the auth client's session lock across subsequent retries.
export function boundedAuthFetch(input,init){
 const method=(init?.method||input?.method||'GET').toUpperCase();
 if(method!=='GET')return fetch(input,init);
 return readWithDeadline(signal=>fetch(input,{...init,signal:init?.signal?AbortSignal.any([signal,init.signal]):signal}));
}
