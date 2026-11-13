import fs from 'node:fs/promises';
import {database} from '../tests/records-fixture.mjs';
const db=await database({records:!process.argv.includes('--baseline')});
try {
 const {rows}=await db.query(`select table_schema,table_name,count(*)::int columns from information_schema.columns where table_schema in ('public','glf_kyc_private','glf_records_private') group by table_schema,table_name order by table_schema,table_name`);
 const {rows:keys}=await db.query(`select constraint_type,count(*)::int count from information_schema.table_constraints where table_schema in ('public','glf_kyc_private','glf_records_private') group by constraint_type`);
 const report={source:'Local PostgreSQL reconstructed from repository migrations; not a live production inventory',tables:rows.length,columns:rows.reduce((n,r)=>n+r.columns,0),maxColumns:Math.max(...rows.map(r=>r.columns)),keys,detail:rows};
 await fs.mkdir('tmp',{recursive:true});await fs.writeFile('tmp/schema-audit'+(process.argv.includes('--baseline')?'-baseline':'')+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await db.close();}
