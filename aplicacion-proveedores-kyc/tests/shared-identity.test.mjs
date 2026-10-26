import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createIdentity,glfIdentity,authErrorKey} from '../src/identity.js';

test('Shared identity routes authentication to GLF and only tokens to the separate data client',async()=>{
 const calls=[],seen=[];
 const auth={signInWithPassword:async args=>{seen.push(args);return {data:{session:{access_token:'test-token'}}};},getSession:async()=>({data:{session:{access_token:'test-token'}}}),signOut:async args=>{seen.push(args);return {data:{}};}};
 const identity=createIdentity({url:'https://data.example',key:'public-data'},(url,key,options)=>{calls.push({url,key,options});return calls.length===1?{auth}:{};});
 await identity.signIn(' ficticio@example.test ','fictional-password');
 assert.equal(calls[0].url,glfIdentity.url);
 assert.equal(calls[1].url,'https://data.example');
 assert.equal(await calls[1].options.accessToken(),'test-token');
 assert.deepEqual(seen[0],{email:'ficticio@example.test',password:'fictional-password'});
 await identity.signOut();assert.deepEqual(seen[1],{scope:'local'});
 assert.equal(authErrorKey({code:'invalid_credentials'}),'credentials');
 assert.equal(authErrorKey({status:401,message:'Invalid JWT'}),'authConnection');
 assert.equal(authErrorKey(Error('NO_PROFILE')),'noProfile');
 assert.equal(authErrorKey(Error('MFA_REQUIRED')),'mfaHelp');
});

test('Federated database: explicit identity, MFA, local permissions and deny-by-default',async t=>{
 const db=new PGlite(),id='00000000-0000-4000-8000-000000000001';
 const jwt={sub:id,iss:glfIdentity.url+'/auth/v1',role:'authenticated',aud:'authenticated',aal:'aal2'};
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;`);
  for(const file of ['202610250001_supplier_directory.sql','202610250002_shared_identity.sql'])await db.exec(await fs.readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.query('insert into public.glf_profiles(id,display_name,supplier_create_scopes,supplier_edit_scopes,supplier_archive_scopes,manage_specialties) values($1,$2,$3,$3,$3,true)',[id,'Ficticio',['government']]);
  assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,0,'No duplicate local auth account');
  async function as(claims,fn){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
  await t.test('approved identity with MFA can read and exercise its scoped permission',()=>as(jwt,async()=>{
   assert.equal((await db.query('select * from glf_profiles')).rows.length,1);
   assert.equal((await db.query("select glf_can('create','government') ok,glf_can('create','glf') no")).rows[0].ok,true);
   assert.equal((await db.query("select glf_can('create','glf') ok")).rows[0].ok,false);
   await db.query("select glf_add_specialty('Prueba federada')");
  }));
  await t.test('wrong issuer, role, audience, OAuth client, and unassigned user cannot read or write',async()=>{
   for(const changes of [{iss:'https://other.example'},{role:'anon'},{aud:'other'},{client_id:'unapproved-client'},{sub:'00000000-0000-4000-8000-000000000002'}])await as({...jwt,...changes},async()=>{
    assert.equal((await db.query('select * from glf_profiles')).rows.length,0);
    assert.equal((await db.query('select * from glf_specialties')).rows.length,0);
    await assert.rejects(db.query("select glf_add_specialty('Blocked')"),/FORBIDDEN/);
   });
  });
  await t.test('MFA is enforced in the database, not only by the login screen',()=>as({...jwt,aal:'aal1'},async()=>{
   assert.equal((await db.query('select * from glf_profiles')).rows.length,1,'Own access requirements visible for challenge');
   assert.equal((await db.query('select * from glf_specialties')).rows.length,0);
   await assert.rejects(db.query("select glf_add_specialty('Blocked')"),/FORBIDDEN/);
   assert.equal((await db.query("select glf_can('archive','government') ok")).rows[0].ok,false);
  }));
  await t.test('user cannot remove MFA, grant access or modify their permissions',()=>as(jwt,async()=>{
   await assert.rejects(db.query('update glf_profiles set require_mfa=false'),/permission denied/);
   await assert.rejects(db.query("insert into glf_profiles(id,display_name) values(gen_random_uuid(),'Intruso')"),/permission denied/);
  }));
  await db.exec('update glf_profiles set active=false');
  await t.test('local deactivation blocks directory access immediately',()=>as(jwt,async()=>{
   assert.equal((await db.query('select * from glf_specialties')).rows.length,0);
   await assert.rejects(db.query("select glf_add_specialty('Blocked')"),/FORBIDDEN/);
  }));
 }finally{await db.close();}
});


test('Access invitations: central account and MFA precede acceptance; inactive profiles are never upgraded',async()=>{
 async function scenario({active=true,level='aal2',profile=null,accepted=true}){
  const events=[];let current=profile;
  const authClient={auth:{getUser:async()=>({data:{user:{id:'fictional',email:'fictional@example.test'}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level,nextLevel:'aal2'}}),listFactors:async()=>({data:{totp:[{status:'verified'}]}})}},rpc:async()=>({data:active})};
  const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:current};}};
  const dataClient={from:()=>query,rpc:async name=>{events.push(name);if(accepted)current={id:'fictional',active:true,require_mfa:true};return {data:accepted};}};
  let n=0;const identity=createIdentity({url:'https://data.example',key:'public'},()=>++n===1?authClient:dataClient);
  try{return {result:await identity.profile(),events};}catch(error){return {error:error.message,events};}
 }
 assert.deepEqual((await scenario({level:'aal1'})).events,[]);
 assert.equal((await scenario({level:'aal1'})).error,'MFA_REQUIRED');
 assert.equal((await scenario({active:false})).error,'ACCOUNT_INACTIVE');
 const accepted=await scenario({});assert.equal(accepted.result.email,'fictional@example.test');assert.deepEqual(accepted.events,['glf_accept_internal_invitation']);
 assert.equal((await scenario({accepted:false})).error,'NO_PROFILE');
 const inactive=await scenario({profile:{active:false,require_mfa:true}});assert.equal(inactive.error,'NO_PROFILE');assert.deepEqual(inactive.events,[]);
});
