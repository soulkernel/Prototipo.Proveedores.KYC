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
// Content-hashed public assets can be cached without retaining stale application versions.
// Dynamic imports keep KYC, administration, manuals and export libraries out of startup.
const result=await build({entryPoints:{app:'src/app.js','manual-external':'src/manual-external.js'},bundle:true,splitting:true,format:'esm',outdir:'dist',entryNames:'assets/[name]-[hash]',chunkNames:'assets/[name]-[hash]',assetNames:'assets/[name]-[hash]',metafile:true,target:['es2022'],minify:true,define:{__CONFIG__:JSON.stringify({mode:demo?'demo':'supabase',kycSupportEmail:process.env.KYC_SUPPORT_EMAIL||'',url:demo?'':url,key:demo?'':key}),__LOGO__:JSON.stringify('data:image/png;base64,'+logo.toString('base64'))}});
const outputs=result.metafile.outputs;
const publicPath=p=>'/'+p.replaceAll('\\','/').replace(/^dist\//,'');
for(const [entry,template,script,css] of [['src/app.js','index.html','/app.js','/app.css'],['src/manual-external.js','manual-externo.html','/manual-external.js','/manual-external.css']]){
 const output=Object.keys(outputs).find(p=>outputs[p].entryPoint===entry&&p.endsWith('.js'));
 const dependencies=new Set();
 const visit=p=>{for(const dep of outputs[p]?.imports||[])if(dep.kind==='import-statement'&&!dep.external&&!dependencies.has(dep.path)){dependencies.add(dep.path);visit(dep.path);}};
 visit(output);
 const preloads=[...dependencies].map(p=>`<link rel="modulepreload" href="${publicPath(p)}">`).join('');
 const html=(await fs.readFile(template,'utf8')).replace(`src="${script}"`,`src="${publicPath(output)}"`).replace(`href="${css}"`,`href="${publicPath(outputs[output].cssBundle)}"`).replace('</head>',preloads+'</head>');
 await fs.writeFile('dist/'+template,html);
}
await fs.cp('public/manual-assets','dist/manual-assets',{recursive:true});
// Diagnostic metadata stays outside the deployed output directory.
await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/build-meta.json',JSON.stringify(result.metafile));
console.log('Build completed: '+(demo?'fictional-data demo':'Supabase authenticated application'));
