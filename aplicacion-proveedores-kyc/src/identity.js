import {createClient} from '@supabase/supabase-js';

// Public connection metadata only. Passwords and signing keys are not copied.
export const glfIdentity={
 url:'https://dcxhuwghakdjcnrqkziq.supabase.co',
 key:'sb_publishable_gZGvMzzkLptA9cC9cRTkOQ_prjPyWr0'
};

export async function unwrapAuth(request){
 const {data,error}=await request;
 if(error)throw error;
 return data;
}

export function createIdentity(config,makeClient=createClient){
 const identity=config.identity||glfIdentity;
 const authClient=makeClient(identity.url,identity.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'glf-operations-identity-v1'}});
 const dataClient=makeClient(config.url,config.key,{accessToken:async()=>{
  const {session}=await unwrapAuth(authClient.auth.getSession());
  return session?.access_token||null;
 }});
 return {
  authClient,dataClient,
  async signIn(email,password){return unwrapAuth(authClient.auth.signInWithPassword({email:email.trim(),password}));},
  async signOut(){return unwrapAuth(authClient.auth.signOut({scope:'local'}));},
  async profile(){
   const {data,error}=await authClient.auth.getUser();
   if(error){if(error.name==='AuthSessionMissingError'||error.status===401||error.status===403)return null;throw error;}
   if(!data.user)return null;
   const valid=await unwrapAuth(authClient.rpc('access_session_valid'));
   if(!valid)throw Error('ACCOUNT_INACTIVE');
   const p=await unwrapAuth(dataClient.from('glf_profiles').select('*').eq('id',data.user.id).maybeSingle());
   if(!p?.active)throw Error('NO_PROFILE');
   const assurance=await unwrapAuth(authClient.auth.mfa.getAuthenticatorAssuranceLevel());
   if((p.require_mfa||assurance.nextLevel==='aal2')&&assurance.currentLevel!=='aal2'){
    const factors=await unwrapAuth(authClient.auth.mfa.listFactors());
    if(!factors.totp?.some(f=>f.status==='verified'))throw Error('MFA_SETUP_REQUIRED');
    throw Error('MFA_REQUIRED');
   }
   return {...p,email:data.user.email||''};
  },
  async verifyMfa(code){
   if(!/^\d{6}$/.test(code))throw Error('MFA_INVALID');
   const factors=await unwrapAuth(authClient.auth.mfa.listFactors());
   const factor=factors.totp?.find(f=>f.status==='verified');
   if(!factor)throw Error('MFA_SETUP_REQUIRED');
   return unwrapAuth(authClient.auth.mfa.challengeAndVerify({factorId:factor.id,code}));
  }
 };
}

// Keep configuration and access errors distinct from an incorrect password.
export function authErrorKey(error){
 const message=String(error?.message||error);
 if(message.includes('MFA_SETUP_REQUIRED'))return 'mfaSetup';
 if(message.includes('MFA_REQUIRED'))return 'mfaHelp';
 if(message.includes('ACCOUNT_INACTIVE'))return 'accountInactive';
 if(message.includes('NO_PROFILE'))return 'noProfile';
 if(message.includes('MFA_INVALID')||error?.code==='mfa_verification_failed')return 'mfaInvalid';
 if(error?.code==='invalid_credentials')return 'credentials';
 if(error?.code==='email_not_confirmed')return 'emailUnconfirmed';
 if(error?.status===429)return 'authRateLimit';
 return 'authConnection';
}
