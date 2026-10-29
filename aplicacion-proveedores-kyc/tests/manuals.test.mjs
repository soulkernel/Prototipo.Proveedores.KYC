import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {internalManual} from '../src/manual-internal-data.js';
import {externalManual} from '../src/manual-external-data.js';
test('Both manuals have complete bilingual chapters and matching screenshot assets',()=>{
 for(const m of [internalManual,externalManual]){
  assert.equal(new Set(m.chapters.map(c=>c.id)).size,m.chapters.length);
  for(const c of m.chapters){
   for(const p of [c.title,c.who,c.intro,c.tip,...c.steps]){assert.equal(p.length,2);assert.ok(p.every(s=>typeof s==='string'&&s.length>0));}
   for(const row of c.rows){assert.equal(row.length,4);assert.ok(row.every(s=>s.length>0));}
   if(c.image)for(const lang of ['es','en'])assert.ok(fs.existsSync(new URL(`../public/manual-assets/${c.image}-${lang}.png`,import.meta.url)));
  }
 }
 assert.ok(internalManual.chapters.find(c=>c.id==='usuarios'));
 assert.ok(internalManual.chapters.find(c=>c.id==='screening'));
 assert.ok(!externalManual.chapters.find(c=>c.id==='usuarios'||c.id==='screening'));
});
test('External manual entry is independent of authenticated application and private tokens',()=>{
 const entry=fs.readFileSync(new URL('../src/manual-external.js',import.meta.url),'utf8');
 assert.ok(!entry.includes('internalManual'));
 assert.ok(!entry.includes('supabase'));
 const invitation=fs.readFileSync(new URL('../src/kyc-invitation.js',import.meta.url),'utf8');
 assert.ok(invitation.includes("new URL('/manual-externo.html',invitation.url)"));
});
