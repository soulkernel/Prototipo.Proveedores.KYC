// Local-only synthetic data; this script is never included in the browser build.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {project} from '../src/kyc-model.js';
const origin=process.env.MANUAL_QA_ORIGIN||'http://127.0.0.1:8770';
if(!/^http:\/\/127\.0\.0\.1:/.test(origin))throw Error('LOCAL_ONLY');
const dir='public/manual-assets';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const answers=project({relation:'supplier',person:'natural',nationalityType:'national',country:'EC',residenceCountry:'EC',idType:'ruc',id:'0000000001001',name:'Andrea Ejemplo',birthCountry:'EC',birthDate:'1990-01-15',nationality:'Ecuatoriana',email:'andrea@example.test',phone:'+593 999999999',city:'Puerto Ayora',address:'Dirección de ejemplo',activity:'Consultoría ambiental',services:'Asesoría técnica',monthlyIncome:'2500',monthlyExpenses:'1200',bankCountry:'EC',bankName:'Banco Pichincha',bankHolder:'Andrea Ejemplo',bankAccount:'0000012345',spouse:'no',pepSelf:'no',pepFamily:'no',glfFamily:'no',truth:'yes',lawfulFunds:'yes',verificationConsent:'yes',incomeSources:'["professional"]',owners:[]});
const now=new Date().toISOString(),expires=new Date(Date.now()+6*864e5).toISOString();
const base={id:'manual-invited',subject_id:'manual-invited',code:101,name:'Andrea Ejemplo',email:'andrea@example.test',relation:'supplier',answers, state:'invited',version:1,review_version:1,edit_epoch:1,pdf_version:null,files:[],events:[{action:'created',created_at:now,detail:'Registro de ejemplo'}],token:'manual-local-only',expires_at:expires,invitation_expires_at:expires,created_at:now,updated_at:now};
const cases=[base,{...base,id:'manual-review',subject_id:'manual-review',code:102,name:'Servicios Insulares Ejemplo',state:'review',token:null,receipt_at:now,screening_status:'pending',screening_revision:1,answers:{...answers,name:'Servicios Insulares Ejemplo'},files:[{id:'report-example',slot:'report',name:'Informe_ejemplo.pdf',version:1,created_at:now}]},{...base,id:'manual-correction',subject_id:'manual-correction',code:103,name:'Consultoría Ejemplo',state:'correction',token:null,note:'Actualizar el documento solicitado.'}];
try{for(const lang of ['es','en']){
 const context=await browser.newContext({viewport:{width:1220,height:1000},deviceScaleFactor:1});
 await context.addInitScript(({cases,lang})=>{if(!sessionStorage.getItem('manual-fixture')){localStorage.setItem('glf-kyc-pilot-v1',JSON.stringify({cases}));localStorage.setItem('glf-user-admin-demo-v1',JSON.stringify({users:[{id:'manual-user',display_name:'Usuario de ejemplo',email:'equipo@example.test',active:true,user_version:1,supplier_create_scopes:['government'],supplier_edit_scopes:['government'],supplier_archive_scopes:[],manage_specialties:true,manage_users:false,kyc_role:'none'}],invitations:[],events:[]}));localStorage.setItem('glf-language',lang);sessionStorage.setItem('manual-fixture','1');}}, {cases,lang});
 const page=await context.newPage();page.on('pageerror',err=>console.error('PAGE',err.message));
 const shot=async(name,selector='.live-main')=>{const el=page.locator(selector).first();await el.waitFor();await el.scrollIntoViewIfNeeded();await page.evaluate(()=>document.activeElement?.blur());const box=await el.boundingBox();await page.screenshot({path:`${dir}/${name}-${lang}.png`,clip:{x:box.x,y:box.y,width:box.width,height:Math.min(box.height,950)},animations:'disabled'});console.log(name,lang);};
 await page.goto(origin);await page.locator('#actor').selectOption('monica');await shot('internal-directory');
 await page.locator('[data-action=open]').first().click();await shot('internal-detail');
 await page.locator('[data-action=edit]').first().click();await shot('internal-editor');
 await page.locator('[data-action=cancel]').first().click();await page.locator('[data-action=directory]').first().click();await page.locator('[data-action=export]').click();await shot('internal-export','#modal');await page.keyboard.press('Escape');
 await page.locator('[data-action=kyc]').click();await page.locator('[data-kyc=new]').waitFor();await shot('internal-inbox');
 await page.locator('[data-kyc=new]').click();await page.locator('#kyc-start-query').fill('0000000009001');await page.locator('#kyc-start-search button').click();await page.locator('[data-start-new]').waitFor();await shot('internal-search');
 await page.locator('[data-kyc=list]').first().click();await page.locator('[data-case="manual-invited"]').click();await shot('internal-invitation','#kyc-invitation-panel');
 await page.locator('[data-kyc=assist]').click();console.log('ASSIST',await page.locator('dialog[open]').innerText());
 await page.locator('dialog[open] textarea').fill('Asistencia de ejemplo para el manual');await page.locator('dialog[open] input[type=checkbox]').check();await page.locator('dialog[open] button[type=submit]').click();await page.locator('#kyc-form').waitFor();await shot('internal-assisted');
 await page.locator('[data-action=users]').click();await page.locator('[data-user-edit]').first().waitFor();await page.locator('[data-user-edit]').first().click();await shot('internal-users','#user-permissions');
 await page.goto(origin);await page.locator('#actor').selectOption('monica');await page.locator('[data-action=kyc]').click();await page.locator('[data-case="manual-review"]').click();
 console.log('REVIEW_PANELS',await page.locator('#kyc-module h2,#kyc-module form').evaluateAll(xs=>xs.map(x=>({tag:x.tagName,id:x.id,text:x.innerText.slice(0,100)}))));
 await shot('internal-screening','#screening-result');await shot('internal-review','#kyc-review');
 // Reset the fixture after assisted entry; external screenshots use the public flow.
 await page.evaluate(c=>localStorage.setItem('glf-kyc-pilot-v1',JSON.stringify({cases:[c]})),base);
 await page.goto(origin+'/#kyc=manual-local-only');if(lang==='en')await page.locator('#kyc-en').click();await page.locator('#kyc-form').waitFor();await shot('external-start');
 for(const [step,name] of [[1,'external-identity'],[2,'external-activity'],[3,'external-related'],[4,'external-declarations'],[5,'external-documents']]){
  if(step===3){await page.locator('[data-kyc="step-0"]').click();await page.locator('[data-field=person]').selectOption('legal');}
  if(step===4){await page.locator('[data-kyc="step-0"]').click();await page.locator('[data-field=person]').selectOption('natural');}
  await page.locator(`[data-kyc="step-${step}"]`).click();
  if(step===3){await page.locator('[data-kyc=add-owner]').click();await page.locator('[data-owner="0"][data-part="name"]').fill('Socio de ejemplo');await page.locator('[data-owner="0"][data-part="pct"]').fill('60');}
  await shot(name,'#kyc-form');
 }
 await context.close();
}}finally{await browser.close();}


