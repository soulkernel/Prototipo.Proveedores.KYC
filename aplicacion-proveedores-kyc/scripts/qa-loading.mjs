import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin=process.env.PERF_ORIGIN||'http://127.0.0.1:8778';
if(!origin.startsWith('http://127.0.0.1:'))throw Error('LOCAL_ONLY');
const meta=JSON.parse(await fs.readFile('tmp/build-meta.json','utf8'));
const initial=new Set();function visit(p){if(initial.has(p))return;initial.add(p);for(const i of meta.outputs[p]?.imports||[])if(i.kind==='import-statement'&&!i.external)visit(i.path);}
visit(Object.keys(meta.outputs).find(p=>meta.outputs[p].entryPoint==='src/app.js'&&p.endsWith('.js')));
const inputs=[...initial].flatMap(p=>Object.keys(meta.outputs[p].inputs));
for(const absent of ['src/kyc-ui.js','src/users-ui.js','src/manual-internal-data.js','src/manual-export.js'])assert.ok(!inputs.includes(absent),absent+' should load on demand');
const bytes=[...initial].reduce((n,p)=>n+meta.outputs[p].bytes,0);assert.ok(bytes<500000,'initial JavaScript budget');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(origin);await page.locator('#actor').waitFor();assert.ok(!requests.some(r=>/kyc-ui-|users-ui-|internal-manual-/.test(r)));
 await page.locator('#actor').selectOption('monica');
 await page.locator('[data-action=guide]').click();await page.locator('.glf-manual').waitFor();assert.equal(await page.locator('[data-manual-chapter]').count(),15);
 await page.locator('[data-action=directory]').click();await page.locator('[data-action=new]').waitFor();
 await page.locator('[data-action=users]').click();await page.locator('[data-user-new]').waitFor();
 await page.locator('[data-action=kyc]').click();await page.locator('[data-kyc=new]').waitFor();
 await page.locator('[data-kyc=new]').click();await page.locator('#kyc-start-query').fill('0000000009001');await page.locator('#kyc-start-search button').click();await page.locator('[data-start-new]').waitFor();
 await page.locator('[data-action=directory]').click();await page.locator('[data-action=new]').click();await page.locator('#f-legal_name').fill('Cambio sin guardar');
 page.once('dialog',d=>d.dismiss());await page.locator('[data-action=kyc]').click();assert.equal(await page.locator('#f-legal_name').inputValue(),'Cambio sin guardar');
 page.once('dialog',d=>d.accept());await page.locator('[data-action=directory]').click();
 await page.locator('#actor').selectOption('viewer');assert.equal(await page.locator('[data-action=kyc]').isDisabled(),true);await page.locator('[data-action=guide]').click();await page.locator('.glf-manual').waitFor();
 await page.reload();await page.locator('#actor').waitFor();
 const cached=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('/assets/')&&r.transferSize===0).length);assert.ok(cached>0,'repeat visit should use asset cache');
 await page.goto(origin+'/#kyc=invalid-local-example');await page.locator('#kyc-external').waitFor();assert.equal(await page.locator('#login-form').count(),0);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({initialJavaScriptBytes:bytes,cachedResources:cached,modules:'manual/users/kyc',unsavedGuard:true,externalRoute:true,errors},null,2));
}finally{await browser.close();}
