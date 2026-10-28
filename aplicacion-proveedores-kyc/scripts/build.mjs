import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{build}=require('esbuild');
const demo=process.argv.includes('--demo')||process.env.GLF_MODE==='demo';
const url=process.env.SUPABASE_URL||'', key=process.env.SUPABASE_PUBLISHABLE_KEY||'';
if(!demo){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw Error('Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, or explicitly choose build:demo.');
 let role='';try{role=JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role;}catch{}
 if(!(key.startsWith('sb_publishable_')||role==='anon'))throw Error('Only a Supabase publishable / anon key may enter the browser build.');
}
const logo=await fs.readFile(new URL('../public/glf-logo.png',import.meta.url));
await fs.mkdir('dist',{recursive:true});
await build({entryPoints:['src/app.js'],bundle:true,external:['./supplier-import.js','./supplier-export.js','./supplier-pdf.js','./kyc-pdf.js','./kyc-screening.js'],format:'esm',outfile:'dist/app.js',target:['es2022'],minify:true,define:{__CONFIG__:JSON.stringify({mode:demo?'demo':'supabase',kycSupportEmail:process.env.KYC_SUPPORT_EMAIL||'',url:demo?'':url,key:demo?'':key}),__LOGO__:JSON.stringify('data:image/png;base64,'+logo.toString('base64'))}});
await build({entryPoints:['src/supplier-import.js'],bundle:true,format:'esm',outfile:'dist/supplier-import.js',target:['es2022'],minify:true});
await build({entryPoints:['src/supplier-export.js'],bundle:true,format:'esm',outfile:'dist/supplier-export.js',target:['es2022'],minify:true});
await build({entryPoints:['src/supplier-pdf.js'],bundle:true,format:'esm',outfile:'dist/supplier-pdf.js',target:['es2022'],minify:true});
await build({entryPoints:['src/kyc-pdf.js','src/kyc-screening.js'],bundle:true,format:'esm',outdir:'dist',target:['es2022'],minify:true});
await fs.copyFile('index.html','dist/index.html');
console.log('Build completed: '+(demo?'fictional-data demo':'Supabase authenticated application'));
