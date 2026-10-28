import test from 'node:test';
import assert from 'node:assert/strict';
import {emailSuggestions,emailField,searchableSelect,helpIcon} from '../src/kyc-compact-controls.js';
test('Email suggestions preserve local part, filter domains, allow custom addresses and require an explicit choice',()=>{
 assert.deepEqual(emailSuggestions('prueba'),[]);
 assert.deepEqual(emailSuggestions('prueba@out'),['prueba@outlook.com']);
 assert.deepEqual(emailSuggestions('Nombre.Apellido+tag@g'),['Nombre.Apellido+tag@gmail.com','Nombre.Apellido+tag@glf.org.ec']);
 assert.deepEqual(emailSuggestions('prueba@gmail.com'),[]);
 assert.deepEqual(emailSuggestions('prueba@empresa.ec'),[]);
 assert.deepEqual(emailSuggestions('prueba@@g'),[]);
 assert.deepEqual(emailSuggestions('prueba nombre@g'),[]);
 assert.match(emailField('prueba@empresa.ec'),/value="prueba@empresa.ec"/);
 assert.match(emailField('x"<'),/&quot;&lt;/);
});
test('Selectors and help are collapsed initially and expose accessible search controls',()=>{
 const html=searchableSelect('sample','Nacionalidad','<option>Ecuatoriana</option>','Ecuatoriana');
 assert.match(html,/<select id="sample" hidden>/);
 assert.match(html,/class="kyc-combo-popup" hidden/);
 assert.match(html,/role="combobox"/);
 assert.match(helpIcon('help','Ayuda','Texto'),/id="help" class="kyc-help-content" hidden/);
});

