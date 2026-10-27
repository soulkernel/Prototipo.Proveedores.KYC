import test from 'node:test';import assert from 'node:assert/strict';
import {parseMoney,formatMoney,validRelatedId} from '../src/kyc-inputs.js';
import {project,validate,entries,fields,fieldLabel} from '../src/kyc-model.js';
import {bankCatalog,filterBanks} from '../src/financial-institutions.js';
test('Money: localized input, canonical precision, empty values and ambiguous/invalid separators',()=>{
 for(const [input,lang,expected] of [['5.000,50','es','5000.50'],['5000','es','5000'],['5,000.50','en','5000.50'],['0','es','0'],['','es',''],['5.000','es','5000']])assert.equal(parseMoney(input,lang),expected);
 for(const s of ['5.00','1,234.56','-2','1e4','5,123','5..000','5,','1000000000000'])assert.equal(parseMoney(s,'es'),null,s);
 assert.equal(formatMoney('5000.50','es'),'5.000,50');assert.equal(formatMoney('5000.5','en'),'5,000.50');assert.equal(formatMoney('','es'),'');assert.equal(formatMoney('0','es'),'0,00');
});
test('Catalog: grouped banks first, searchable accents and aliases, no duplicates',()=>{
 assert.equal(bankCatalog[0].group,'banks');assert.equal(new Set(bankCatalog.map(x=>x.name)).size,bankCatalog.length);
 assert.equal(bankCatalog.filter(x=>x.group==='banks').length,27);assert.ok(bankCatalog.filter(x=>x.group==='cooperatives').length>350);
 assert.ok(filterBanks('JEP').some(b=>b.name.includes('JUVENTUD')));assert.ok(filterBanks('pacifico').some(b=>b.name.includes('Pacífico')));
});
test('Related identity and PDF labels distinguish personal RUC from entity and preserve leading zeros',()=>{
 assert.equal(validRelatedId('cedula','0000000001','EC'),true);assert.equal(validRelatedId('ruc','0000000001001','EC'),true);assert.equal(validRelatedId('ruc','0000000001001','US'),false);assert.equal(validRelatedId('passport','QA-001','US'),true);assert.equal(validRelatedId('license','QA-001','US'),false);
 const a=project({relation:'supplier',person:'legal',country:'EC',bankCountry:'EC',bankAccount:'00000123',monthlyIncome:'5000.50',legalRepIdType:'passport',legalRepId:'QA001',legalRepCountry:'US',owners:[{name:'FICTICIO',pct:'10',country:'EC',idType:'ruc',id:'0000000001001'}]});
 assert.equal(a.owners[0].idType,'ruc');assert.ok(!validate(a,3).includes('legalRepId'));assert.ok(!validate(a,3).includes('owners'));
 assert.ok(entries(a,'es').some(([k,v])=>k.includes('Ingresos')&&v==='5.000,50'));assert.ok(entries(a,'es').some(([k,v])=>k==='Número de cuenta'&&v==='00000123'));
 const label=fieldLabel(fields.find(f=>f.key==='legalRepId'),a,'es');assert.match(label,/pasaporte/);
 assert.equal(project({...a,relation:'staff'}).bankCountry,undefined);assert.equal(project({...a,relation:'staff'}).legalRepIdType,undefined);
});

