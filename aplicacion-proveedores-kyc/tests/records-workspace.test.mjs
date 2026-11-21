import test from 'node:test';
import assert from 'node:assert/strict';
import {database,ids,as,call} from './records-fixture.mjs';
test('Workspace trays group states before pagination and protect counts, filters and core RPC',async()=>{
 const db=await database();try{
  for(const [name,id] of Object.entries(ids))await db.query('insert into glf_profiles(id,display_name,manage_users) values($1,$2,$3)',[id,name,name==='admin']);
  const run=(who,action,data={})=>as(db,ids[who],()=>call(db,action,null,null,data));
  const boot=await run('admin','bootstrap'),admin=await run('admin','admin');
  await run('admin','member',{user_id:ids.writer,unit_id:boot.units[0].id,site_id:boot.sites[0].id,initials:'WR',job_title:'QA',roles:admin.roles.filter(r=>r.name==='Redacción').map(r=>r.id),reason:'Workspace fixture'});
  const base={direction:'outgoing',subject:'Visible workspace',body:'Test letter content',classification:'ordinary',recipients:[]};
  for(let i=0;i<55;i++)await run('writer','save',{...base,subject:base.subject+' '+i});
  const secret=await run('writer','save',{...base,subject:'Restricted hidden',classification:'restricted'});
  let list=await run('reader','list',{direction:'outgoing',view:'drafts'});
  assert.equal(list.total,55);assert.equal(list.rows.length,50);assert.equal(list.draft_count,55);assert.ok(!list.rows.some(r=>r.id===secret));
  const second=await run('reader','list',{direction:'outgoing',view:'drafts',offset:50});assert.equal(second.total,55);assert.equal(second.rows.length,5);assert.ok(second.rows.every(r=>!list.rows.some(a=>a.id===r.id)));
  await db.query("update glf_records_private.documents set status='review' where id=$1",[list.rows[0].id]);
  await db.query("update glf_records_private.documents set status='prepared' where id=$1",[list.rows[1].id]);
  await db.query("update glf_records_private.documents set status='prepared' where id=$1",[secret]);
  list=await run('reader','list',{direction:'outgoing',view:'signature'});assert.equal(list.total,2);assert.deepEqual(new Set(list.rows.map(r=>r.status)),new Set(['review','prepared']));
  assert.equal((await run('reader','list',{direction:'outgoing',view:'signature',status:'review'})).total,1);
  assert.equal((await run('reader','list',{direction:'outgoing',view:'signature',q:'Restricted hidden'})).total,0);
  assert.equal((await run('reader','list',{direction:'outgoing',view:'dispatch'})).total,0);
  assert.equal((await run('reader','list',{direction:'incoming',view:'attention'})).total,0);
  await assert.rejects(run('reader','list',{direction:'incoming',view:'signature'}),/INVALID_VIEW/);
  await assert.rejects(run('reader','list',{date_from:'2026-12-31',date_to:'2026-01-01'}),/INVALID_DATE/);
  await assert.rejects(as(db,ids.reader,()=>call(db,'list'), 'aal1'),/FORBIDDEN/);
  await assert.rejects(as(db,null,()=>call(db,'list')),/permission denied/);
  await assert.rejects(as(db,ids.reader,()=>db.query("select glf_records_private.core_v031('list')")),/permission denied/);
 }finally{await db.close();}
});
