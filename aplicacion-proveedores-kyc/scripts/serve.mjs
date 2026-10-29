import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
export function server(){return http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname,name=pathname==='/'?'index.html':pathname.slice(1);
 const asset=/^assets\/[A-Za-z0-9_-]+-[A-Z0-9]{8}\.(js|css)$/.test(name);
 if(!['index.html','manual-externo.html'].includes(name)&&!asset&&!/^manual-assets\/[a-z-]+\.png$/.test(name)){res.writeHead(404);res.end();return;}
 const filename=path.resolve('dist',name);if(!fs.existsSync(filename)){res.writeHead(404);res.end('Resource not found. Build the application first.');return;}
 res.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':'text/html; charset=utf-8','Cache-Control':asset?'public, max-age=31536000, immutable':'no-store'});fs.createReadStream(filename).pipe(res);
});}
if(process.argv[1]?.endsWith('serve.mjs'))server().listen(Number(process.env.PORT)||8770,'127.0.0.1',()=>console.log('http://127.0.0.1:'+(process.env.PORT||8770)));
