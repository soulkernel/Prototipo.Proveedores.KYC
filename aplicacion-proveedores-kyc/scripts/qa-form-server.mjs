// Local-only fictional fixtures. Never part of the production build.
import http from 'node:http';import {server} from './serve.mjs';import {project} from '../src/kyc-model.js';
const app=server();
const answers=project({relation:'supplier',person:'natural',nationalityType:'national',country:'EC',residenceCountry:'EC',idType:'ruc',id:'0000000001001',name:'PRUEBA FICTICIA FORMULARIO',birthCountry:'EC',birthDate:'1990-01-01',nationality:'Ecuatoriana',email:'qa@example.test',phone:'0000000000',city:'Quito',address:'Domicilio ficticio',activity:'Pruebas ficticias',services:'Pruebas',monthlyIncome:'5000',monthlyExpenses:'1250.50',bankCountry:'EC',bankName:'Banco Pichincha',bankHolder:'PERSONA FICTICIA',bankAccount:'000001234',spouse:'no',pepSelf:'no',pepFamily:'no',glfFamily:'no',truth:'yes',lawfulFunds:'yes',verificationConsent:'yes',incomeSources:'["professional"]',funds:'Actividad ficticia',owners:[]});
http.createServer((req,res)=>{
 if(req.url==='/qa-form'){
 const row={id:'qa-form',code:99999,name:answers.name,email:answers.email,relation:'supplier',answers,state:'invited',version:1,edit_epoch:1,pdf_version:null,files:[],events:[],token:'local-qa-only',expires_at:new Date(Date.now()+86400000).toISOString()};
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<script>localStorage.setItem("glf-kyc-pilot-v1",'+JSON.stringify(JSON.stringify({cases:[row]}))+');location.replace("/#kyc=local-qa-only");</script>');
 }else app.emit('request',req,res);
}).listen(8776,'127.0.0.1',()=>console.log('QA http://127.0.0.1:8776/qa-form'));
