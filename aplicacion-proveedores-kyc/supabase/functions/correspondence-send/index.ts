import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {buildMail} from './mime.mjs';
const env=(key:string)=>Deno.env.get(key)||'';
// Existing GLF OIDC tokens are verified by Postgres. Deploy this function with verify_jwt=false;
// NEVER remove the authenticated RPC check or allow a caller-supplied service key/remitter.
Deno.serve(async req=>{
 const origin=req.headers.get('Origin')||'',allowed=env('GLF_ALLOWED_ORIGIN');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const response=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers});
 if(!allowed||origin!==allowed)return response(403,{error:'FORBIDDEN_ORIGIN'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return response(405,{error:'METHOD_NOT_ALLOWED'});
 const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))return response(401,{error:'AUTH_REQUIRED'});
 const url=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY');
 const user=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const access=await user.rpc('glf_records',{p_action:'bootstrap'});
 if(access.error||!(access.data?.admin||access.data?.permissions?.includes('dispatch')))return response(403,{error:'FORBIDDEN'});
 const configured=['GLF_GMAIL_CLIENT_ID','GLF_GMAIL_CLIENT_SECRET','GLF_GMAIL_REFRESH_TOKEN','GLF_GMAIL_FROM'].every(k=>!!env(k));
 let body;try{body=await req.json();}catch{return response(400,{error:'INVALID_REQUEST'});}
 if(body.operation==='status')return response(200,{configured,from:configured?env('GLF_GMAIL_FROM'):null});
 if(!configured)return response(503,{error:'MAIL_NOT_CONFIGURED'});
 let id:string|null=null,started=false;
 const service=createClient(url,env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
 const finish=async(action:string,providerId:string|null=null)=>{if(id)await service.rpc('glf_records_dispatch_worker',{p_id:id,p_action:action,p_provider_id:providerId});};
 try{
  // Obtain credentials before claiming the operation; no document is sent on OAuth failure.
  const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env('GLF_GMAIL_CLIENT_ID'),client_secret:env('GLF_GMAIL_CLIENT_SECRET'),refresh_token:env('GLF_GMAIL_REFRESH_TOKEN'),grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});
  if(!tokenResponse.ok)return response(503,{error:'MAIL_AUTH_UNAVAILABLE'});const token=await tokenResponse.json();
  const prepared=await user.rpc('glf_records_prepare_dispatch',{p_id:body.document_id,p_version:body.version,p_email:body.email,p_subject:body.subject,p_message:body.message,p_cc:body.cc||''});
  if(prepared.error)return response(409,{error:'DISPATCH_NOT_PREPARED'});id=prepared.data;
  const claim=await service.rpc('glf_records_dispatch_worker',{p_id:id,p_action:'claim'});if(claim.error)return response(409,{error:'DISPATCH_ALREADY_CLAIMED_OR_INVALID'});
  const payload=claim.data,attachments=[];
  for(const file of payload.files){const downloaded=await service.storage.from('glf-correspondence').download(file.path);if(downloaded.error)throw Error('FILE_MISSING');const bytes=new Uint8Array(await downloaded.data.arrayBuffer());if(bytes.byteLength!==file.size)throw Error('FILE_SIZE_MISMATCH');attachments.push({...file,bytes});}
  const raw=buildMail({from:env('GLF_GMAIL_FROM'),to:payload.recipient_email,cc:payload.cc_email,replyTo:env('GLF_GMAIL_REPLY_TO')||env('GLF_GMAIL_FROM'),subject:payload.subject,message:payload.message,attachments,messageId:`${id}@glf-correspondence.invalid`});
  started=true;
  const sent=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({raw}),signal:AbortSignal.timeout(25000)});
  if(!sent.ok){await finish(sent.status>=500?'uncertain':'failed');return response(502,{error:sent.status>=500?'DELIVERY_UNCERTAIN':'DELIVERY_REJECTED'});}
  const receipt=await sent.json();if(!receipt.id)throw Error('RECEIPT_MISSING');
  const saved=await service.rpc('glf_records_dispatch_worker',{p_id:id,p_action:'sent',p_provider_id:receipt.id});if(saved.error)return response(502,{error:'DELIVERY_UNCERTAIN'});
  return response(200,{status:'sent',id});
 }catch{await finish(started?'uncertain':'failed');return response(502,{error:started?'DELIVERY_UNCERTAIN':'DISPATCH_FAILED'});}
});
