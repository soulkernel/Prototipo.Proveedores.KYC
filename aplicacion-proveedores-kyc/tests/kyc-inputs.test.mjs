import test from 'node:test';import assert from 'node:assert/strict';
import {parseMoney,formatMoney,validRelatedId} from '../src/kyc-inputs.js';
import {project,validate,entries,fields,fieldLabel} from '../src/kyc-model.js';
import {bankCatalog,filterBanks} from '../src/financial-institutions.js';
import {nationalities,nationalityOptions,resolveNationality,nationalityLabel} from '../src/nationalities.js';
import {nationalitySelectOptions} from '../src/nationality-field.js';
test('Nationality catalog has unique canonical values, priority ordering, accent-free search and bilingual display',()=>{
 assert.equal(nationalities.length,196);assert.equal(new Set(nationalities.map(n=>n.code)).size,196);assert.equal(new Set(nationalities.map(n=>n.es)).size,196);
 for(const lang of ['es','en'])assert.deepEqual(nationalityOptions('',lang).slice(0,4).map(n=>n.code),['EC','US','CO','PE']);
 for(const value of ['ecu','EC','Ecuador','ecuatoriano','ECUATORIANA','Ecuadorian'])assert.equal(resolveNationality(value).es,'Ecuatoriana');
 assert.equal(nationalityLabel('Ecuatoriana','en'),'Ecuadorian');assert.equal(resolveNationality('USA').es,'Estadounidense');
 assert(nationalityOptions('espana').some(n=>n.code==='ES'));assert(nationalityOptions('aleman').some(n=>n.code==='DE'));assert(nationalityOptions('japon').some(n=>n.code==='JP'));
 assert.equal(resolveNationality('valor antiguo no identificado'),null);
 const s=nationalitySelectOptions('Ecuatoriana','japon','en');assert(s.html.includes('value="Ecuatoriana" selected'));assert(s.html.includes('value="Japonesa"'));assert.equal(s.count,1);
 assert(nationalitySelectOptions('Texto antiguo','','es').html.includes('selected disabled value="Texto antiguo"'));
 assert(entries({relation:'staff',person:'natural',nationality:'Ecuatoriana'},'en').some(([k,v])=>k==='Nationality'&&v==='Ecuadorian'));
});
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

