import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:8783',browser=await chromium.launch({channel:'chrome',headless:true});
const user={id:'00000000-0000-4000-8000-000000000001',email:'startup@example.test',aud:'authenticated',role:'authenticated',factors:[{id:'test-factor',factor_type:'totp',status:'verified'}]};
const token=[{alg:'HS256',typ:'JWT'},{sub:user.id,exp:Math.floor(Date.now()/1000)+3600,aal:'aal2',role:'authenticated'},'synthetic'].map(x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url')).join('.');
const session={access_token:token,refresh_token:'synthetic-only',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
const profile={id:user.id,active:true,require_mfa:true,display_name:'Prueba local',supplier_create_scopes:['government'],supplier_edit_scopes:['government'],supplier_archive_scopes:[],manage_specialties:false};
const row={id:'00000000-0000-4000-8000-000000000002',code:901,scope:'government',person_type:'natural',id_type:'ruc',id_number:'0000000090001',legal_name:'Proveedor de prueba local',city:'Santa Cruz',country_name:'Ecuador',email:'synthetic@example.test',phone:'0000000000',active:true,offer_type:'services',glf_supplier_specialties:[]};
try{
 const context=await browser.newContext();await context.addInitScript(s=>localStorage.setItem('glf-operations-identity-v1',JSON.stringify(s)),session);
 const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));let failDirectory=true;
 await page.route('https://*.supabase.co/**',async route=>{
  const p=new URL(route.request().url()).pathname;requests.push({path:p,at:Date.now()});let value;
  if(p==='/auth/v1/user'){await new Promise(r=>setTimeout(r,250));value=user;}
  else if(p==='/rest/v1/rpc/access_session_valid'){await new Promise(r=>setTimeout(r,500));value=true;}
  else if(p==='/rest/v1/glf_profiles'){await new Promise(r=>setTimeout(r,500));value=profile;}
  else if(p==='/rest/v1/glf_suppliers'){if(failDirectory)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'synthetic unavailable'})});value=[row];}
  else if(p==='/rest/v1/glf_specialties')value=[];
  else throw Error('Unexpected backend request '+p);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
 });
 await page.goto(origin);await page.getByRole('heading',{name:'Verificando acceso…'}).waitFor();
 assert.equal(await page.locator('#results').count(),0);
 await page.getByText('Esto no significa que no existan proveedores.',{exact:false}).waitFor();
 assert.equal(await page.locator('#results').count(),0);
 const valid=requests.find(x=>x.path.endsWith('access_session_valid')),local=requests.find(x=>x.path.endsWith('glf_profiles'));
 assert.ok(Math.abs(valid.at-local.at)<300,'profile and validity requests overlap');
 failDirectory=false;await page.getByRole('button',{name:'Reintentar'}).click();await page.locator('#results').getByText(row.legal_name).waitFor();
 const timeoutContext=await browser.newContext();await timeoutContext.addInitScript(s=>localStorage.setItem('glf-operations-identity-v1',JSON.stringify(s)),session);
 const timeoutPage=await timeoutContext.newPage();let hanging=true,held;
 await timeoutPage.route('https://*.supabase.co/**',async route=>{
  const p=new URL(route.request().url()).pathname;
  if(hanging&&p==='/auth/v1/user'){held=route;return;}
  const value=p==='/auth/v1/user'?user:p.endsWith('access_session_valid')?true:p.endsWith('glf_profiles')?profile:p.endsWith('glf_suppliers')?[row]:[];
  await route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
 });
 await timeoutPage.goto(origin);await timeoutPage.getByRole('heading',{name:'Verificando acceso…'}).waitFor();
 await timeoutPage.getByRole('button',{name:'Reintentar'}).waitFor({timeout:20000});
 assert.equal(await timeoutPage.locator('#results').count(),0);
 hanging=false;await held.fulfill({contentType:'application/json',body:JSON.stringify(user)});
 await timeoutPage.getByRole('button',{name:'Reintentar'}).click();await timeoutPage.locator('#results').getByText(row.legal_name).waitFor();
 await page.screenshot({path:'tmp/startup-recovered.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({parallelRequestGapMs:Math.abs(valid.at-local.at),directoryFailureNotEmpty:true,directoryRetry:true,accessTimeout:true,accessRetry:true,errors}));
}finally{await browser.close();}
