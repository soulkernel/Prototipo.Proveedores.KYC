import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {internalManual} from '../src/manual-internal-data.js';
import {externalManual} from '../src/manual-external-data.js';
const origin=process.env.MANUAL_QA_ORIGIN||'http://127.0.0.1:8777';
if(!/^http:\/\/127\.0\.0\.1:/.test(origin))throw Error('LOCAL_ONLY');
const out='output/manuals';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],results=[];
try{
 for(const manual of [externalManual,internalManual])for(const lang of ['es','en']){
  const context=await browser.newContext({viewport:{width:1360,height:1000},acceptDownloads:true});
  await context.addInitScript(l=>localStorage.setItem('glf-language',l),lang);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/manual-')&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.goto(origin+(manual.audience==='external'?`/manual-externo.html?lang=${lang}`:''));
  if(manual.audience==='internal'){
   await page.locator('#actor').selectOption('viewer');
   await page.locator('[data-action=guide]').click();
   assert.equal(await page.locator('[data-action=kyc]').isDisabled(),true);
  }
  await page.locator('.glf-manual').waitFor();
  assert.equal(await page.locator('[data-manual-chapter]').count(),manual.chapters.length);
  if(manual.audience==='internal'){
   assert.equal(await page.locator('#manual-screening').count(),1);
   assert.equal(await page.locator('#manual-usuarios').count(),1);
  }else assert.equal(await page.locator('#manual-screening,#manual-usuarios,[data-action=kyc]').count(),0);
  await page.locator('#manual-search').fill('zz-no-match-123');
  assert.equal(await page.locator('[data-manual-chapter]:visible').count(),0);
  assert.equal(await page.locator('#manual-empty').isVisible(),true);
  await page.locator('#manual-search').fill('firma');
  // Downloads must still include every chapter while a filter is applied.
  for(const ext of ['pdf','docx']){
   const event=page.waitForEvent('download',{timeout:60000});
   await page.locator(`[data-manual-download=${ext}]`).click();
   const download=await event;await download.saveAs(`${out}/${download.suggestedFilename()}`);
   assert.equal(await download.failure(),null);
   await page.locator('[data-manual-download=pdf]:enabled').waitFor();
  }
  await page.locator('#manual-search').fill('');
  assert.equal(await page.locator('[data-manual-chapter]:visible').count(),manual.chapters.length);
  const last=manual.chapters.at(-1).id;
  await page.locator(`[data-manual-jump=${last}]`).click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'manual-'+last);
  await page.locator('[data-manual-image]').last().click();await page.locator('dialog.manual-image-dialog[open]').waitFor();
  await page.keyboard.press('Escape');await page.locator('.manual-image-dialog').waitFor({state:'detached'});
  await page.evaluate(()=>{document.querySelectorAll('.glf-manual img').forEach(i=>i.loading='eager');});
  await page.waitForFunction(()=>[...document.querySelectorAll('.glf-manual img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`${out}/web-${manual.audience}-${lang}.png`});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo(0,0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'mobile overflow');
  await page.screenshot({path:`${out}/mobile-${manual.audience}-${lang}.png`});
  results.push({audience:manual.audience,lang,chapters:manual.chapters.length,downloads:2,mobile:true});
  await context.close();
 }
 assert.deepEqual(errors,[]);
 await fs.writeFile(`${out}/qa.json`,JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
