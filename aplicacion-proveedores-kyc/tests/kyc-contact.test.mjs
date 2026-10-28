import test from 'node:test';
import assert from 'node:assert/strict';
import {callingCountries,splitPhone,phoneValue,phoneOptions,phoneField,readPhoneField,cityField,residenceCities,galapagosCities} from '../src/kyc-contact-fields.js';
import {project,entries} from '../src/kyc-model.js';

test('Calling codes prioritize common countries, search accents/codes, and keep selection when filtered',()=>{
 assert.deepEqual(callingCountries().slice(0,4).map(n=>[n.country,n.code]),[['EC','+593'],['US','+1'],['CO','+57'],['PE','+51']]);
 assert.ok(callingCountries('espana').some(n=>n.country==='ES'));
 assert.ok(callingCountries('+593','en').some(n=>n.name==='Ecuador'));
 assert.match(phoneOptions('EC','Japan','en').html,/value="EC" selected/);
 assert.match(phoneOptions('EC','Japan','en').html,/Japan/);
 assert.match(phoneField('','es'),/value="EC" selected/);
 assert.equal(phoneValue('EC',''),'');
});
test('International numbers are not duplicated, Ecuador trunk zero is removed, Italian significant zero and extensions survive',()=>{
 assert.equal(phoneValue('EC','0991234567'),'+593 991234567');
 assert.equal(phoneValue('EC','+593 99 123 4567'),'+593 991234567');
 assert.equal(phoneValue('EC','0057 3001234567'),'+57 3001234567');
 assert.equal(phoneValue('IT','06 12345678'),'+39 0612345678');
 assert.equal(phoneValue('US','2025550123 ext. 12'),'+1 2025550123 ext. 12');
 assert.deepEqual(splitPhone('+57 3001234567'),{country:'CO',number:'3001234567'});
 assert.deepEqual(splitPhone('0991234567'),{country:'EC',number:'0991234567'});
 assert.deepEqual(splitPhone('+999 1234567'),{country:'__legacy',number:'+999 1234567'});
 // Reading another field must not rewrite a legacy number merely because the widget now has a prefix.
 const box={dataset:{original:'0991234567',initialCountry:'EC',initialNumber:'0991234567'},querySelector:s=>({value:s.includes('country')?'EC':'0991234567'})};
 assert.equal(readPhoneField({querySelector:()=>box}),'0991234567');
 const s=project({person:'natural',country:'EC',phone:phoneValue('EC','0991234567')});
 assert.equal(s.phone,'+593 991234567');assert.ok(entries(s,'es').some(([k,v])=>k==='Teléfono'&&v==='+593 991234567'));
});
test('Galapagos populations come first, Other supports foreign and legacy cities without changing values',()=>{
 assert.deepEqual(residenceCities.slice(0,4),['Puerto Ayora','Puerto Baquerizo Moreno','Puerto Villamil','Puerto Velasco Ibarra']);
 assert.equal(new Set(residenceCities).size,residenceCities.length);
 const html=cityField('Puerto Villamil');assert.match(html,/value="Puerto Villamil" selected/);
 assert.ok(html.indexOf(galapagosCities[0])<html.indexOf('Quito'));
 assert.match(cityField('New York','en'),/value="__other" selected/);
 assert.match(cityField('New York','en'),/value="New York"/);
 assert.match(cityField('','es',true),/id="kyc-city-other"/);
 assert.doesNotMatch(cityField(''),/id="kyc-city-other"/);
 assert.match(cityField('<script>'),/&lt;script&gt;/);
});

