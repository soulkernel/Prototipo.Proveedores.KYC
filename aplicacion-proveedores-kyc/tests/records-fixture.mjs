import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
export async function database({records=true,through='999999999999'}={}) {
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid(),auth.jwt() to authenticated,anon;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text unique,metadata jsonb);
 alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated,anon;`);
 const directory=new URL('../supabase/migrations/',import.meta.url);
 for(const name of (await fs.readdir(directory)).filter(n=>n.endsWith('.sql')&&n.slice(0,12)<=through&&(records||!n.includes('records'))).sort())await db.exec(await fs.readFile(new URL(name,directory),'utf8'));
 return db;
}
export const ids={admin:'00000000-0000-4000-8000-000000000091',writer:'00000000-0000-4000-8000-000000000092',reader:'00000000-0000-4000-8000-000000000093',signer:'00000000-0000-4000-8000-000000000094',receiver:'00000000-0000-4000-8000-000000000095'};
export async function as(db,id,fn,aal='aal2') {
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(id?{sub:id,iss:'https://dcxhuwghakdjcnrqkziq.supabase.co/auth/v1',aud:'authenticated',role:'authenticated',aal}:{})]);
 await db.exec('set role '+(id?'authenticated':'anon'));try{return await fn();}finally{await db.exec('reset role');}
}
export const call=(db,action,id=null,version=null,data={})=>db.query('select public.glf_records($1,$2,$3,$4::jsonb) result',[action,id,version,JSON.stringify(data)]).then(r=>r.rows[0].result);
