import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdentity} from '../src/identity.js';
import {readWithDeadline} from '../src/read-deadline.js';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture({valid=true,level='aal2',profile={id:'test',active:true,require_mfa:true},pause}={}){
 const events=[];let n=0;
 const query=p=>({abortSignal(){return this;},then: (...args)=>p.then(...args)});
 const auth={auth:{getUser:async()=>{events.push('user');return {data:{user:{id:'test',email:'synthetic@example.test'}}};},mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level,nextLevel:'aal2'}}),listFactors:async()=>({data:{totp:[{status:'verified'}]}})}},rpc(){events.push('valid');return query((pause?.promise||Promise.resolve()).then(()=>({data:valid})));}};
 const db={from(){return {select(){return this;},eq(){return this;},maybeSingle(){events.push('profile');return query(Promise.resolve({data:profile}));}};},rpc(){events.push('accept');return Promise.resolve({data:true});}};
 return {identity:createIdentity({url:'https://example.test',key:'public'},()=>++n===1?auth:db),events};
}
test('profile and access validity run concurrently, but no profile is released before validation',async()=>{
 const pause=deferred(),f=fixture({pause});let done=false;
 const request=f.identity.profile().then(p=>{done=true;return p;});
 await new Promise(r=>setImmediate(r));
 assert.deepEqual(f.events,['user','valid','profile']);assert.equal(done,false);
 pause.resolve();assert.equal((await request).active,true);
});
test('inactive account, missing MFA and inactive profile still deny access',async()=>{
 for(const [options,error] of [[{valid:false},'ACCOUNT_INACTIVE'],[{level:'aal1'},'MFA_REQUIRED'],[{profile:{active:false,require_mfa:true}},'NO_PROFILE']]){
  const f=fixture(options);await assert.rejects(f.identity.profile(),new RegExp(error));assert.ok(!f.events.includes('accept'));
 }
});
test('timed-out access never accepts an invitation after a late response',async()=>{
 const pause=deferred(),f=fixture({pause,profile:null});
 await assert.rejects(readWithDeadline(signal=>f.identity.profile({signal}),15),/READ_TIMEOUT/);
 pause.resolve();await new Promise(r=>setImmediate(r));assert.ok(!f.events.includes('accept'));
});
test('deadline aborts reads and a retry has a fresh signal',async()=>{
 let expired;await assert.rejects(readWithDeadline(signal=>{expired=signal;return new Promise(()=>{});},15),/READ_TIMEOUT/);
 assert.equal(expired.aborted,true);
 assert.equal(await readWithDeadline(signal=>{assert.equal(signal.aborted,false);return 42;}),42);
});
