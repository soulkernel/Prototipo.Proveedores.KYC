import test from 'node:test';
import assert from 'node:assert/strict';
import {activityCatalog} from '../src/activity-catalog.js';
import {activityOptions,splitActivities,joinActivities,activityField,activityLabel,readActivityField} from '../src/kyc-activity-fields.js';
import {entries,project,validate} from '../src/kyc-model.js';
test('Optimized workbook catalog preserves 148 distinct entries, source cells and English labels',()=>{
 assert.equal(activityCatalog.length,148);assert.equal(new Set(activityCatalog.map(r=>r.es)).size,148);
 assert.equal(activityCatalog[0].cell,'M2');assert.equal(activityCatalog.at(-1).cell,'M149');
 assert.ok(activityCatalog.every(r=>r.en&&r.es));
 assert.match(activityOptions('','computacion').html,/Suministro de equipos de computación/);
 assert.match(activityOptions('','solar','en').html,/Solar panel sales and supply/);
 assert.match(activityOptions('','zzz').html,/value="__other"/);
});
test('Multiple selections and custom legacy descriptions survive projection and display without duplicates',()=>{
 const value=joinActivities(['Desarrollo de software','Desarrollo de software','Consultoría ambiental'],'Servicio a medida');
 assert.equal(value,'Desarrollo de software\nConsultoría ambiental\nServicio a medida');
 assert.deepEqual(splitActivities(value),{selected:['Desarrollo de software','Consultoría ambiental'],other:'Servicio a medida'});
 assert.equal(activityLabel(value,'en'),'Software development\nEnvironmental consulting\nServicio a medida');
 const a=project({relation:'supplier',person:'natural',country:'EC',activity:value,services:'Desarrollo de software'});
 assert.equal(a.activity,value);assert.ok(entries(a,'en').some(([k,v])=>k==='Economic or professional activity'&&v.includes('Software development')));
 assert.equal(project({...a,relation:'staff'}).activity,undefined);
 assert.ok(validate({...a,activity:''},2).includes('activity'));
 const old='Descripción anterior\n\ncon detalles';
 const box={dataset:{original:old,initial:old},querySelectorAll:()=>[],querySelector:()=>({value:old})};
 assert.equal(readActivityField({querySelector:()=>box},'activity'),old);
});
test('Choices are independent, escaped, removable and constrained to the existing 2000-character field',()=>{
 assert.match(activityOptions('Desarrollo de software','software').html,/value="Desarrollo de software" disabled/);
 assert.match(activityOptions('x'.repeat(1999),'software').html,/value="Desarrollo de software" disabled/);
 assert.match(activityField('services','<img src=x>'),/&lt;img src=x&gt;/);
 assert.match(activityField('activity','Desarrollo de software'),/data-remove-choice="Desarrollo de software"/);
 assert.doesNotMatch(activityField('services',''),/data-selected-choice=/);
 assert.equal(joinActivities([],''),'');
});

