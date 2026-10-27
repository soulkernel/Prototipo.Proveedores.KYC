import fs from 'node:fs/promises';
import {fields} from '../src/kyc-model.js';
let previous=await fs.readFile('supabase/migrations/202610250012_approved_form.sql','utf8');
let functions=previous.slice(previous.indexOf('create or replace function glf_kyc_private.project'),previous.indexOf('create or replace function glf_kyc_private.documents'));
functions=functions.replace("'id',trim(coalesce(o->>'id',''))", "'id',trim(coalesce(o->>'id','')),'idType',trim(coalesce(o->>'idType',''))");
functions=functions.replace("if f->>'type'='number' and v !~ '^[0-9]+(\\.[0-9]{1,2})?$' then errs=array_append(errs,f->>'key');end if;", ()=>"if f->>'type'='number' then if v !~ '^[0-9]+(\\.[0-9]{1,2})?$' then errs=array_append(errs,f->>'key');elsif v::numeric>999999999999.99 then errs=array_append(errs,f->>'key');end if;end if;");
functions=functions.replace("or length(o->>'id')>60 then", "or length(o->>'id')>60 or not glf_kyc_private.related_id_valid(o->>'idType',o->>'id',o->>'country') then");
functions=functions.replace('end if;return errs;',`end if;
 if a->>'person'='legal' and not glf_kyc_private.related_id_valid(a->>'legalRepIdType',a->>'legalRepId',a->>'legalRepCountry') then errs=array_append(errs,'legalRepId');end if;
 if a->>'person'='natural' and a->>'spouse'='yes' and not glf_kyc_private.related_id_valid(a->>'spouseIdType',a->>'spouseId',a->>'spouseCountry') then errs=array_append(errs,'spouseId');end if;
 return array(select distinct e from unnest(errs) e);`);
const sql=`-- Form usability v3. No changes to stored answers, files, access policies or grants.
begin;
alter table public.glf_kyc_cases alter column form_version set default '2026-10-26.3';
create or replace function glf_kyc_private.fields() returns jsonb language sql immutable set search_path='' as $fields$ select '${JSON.stringify(fields).replaceAll("'","''")}'::jsonb $fields$;
create or replace function glf_kyc_private.related_id_valid(kind text,number text,country text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(kind in('cedula','ruc','passport','foreign_id','tax_id') and length(number) between 1 and 60 and case when kind='cedula' then country='EC' and number ~ '^[0-9]{10}$' when kind='ruc' then country='EC' and number ~ '^[0-9]{13}$' else true end,false)
$$;
revoke all on function glf_kyc_private.related_id_valid(text,text,text) from public,anon,authenticated;
${functions}
-- Keep the existing audited RPC implementations and access controls; stamp only new saves.
do $version$
declare fn regprocedure;definition text;
begin
 foreach fn in array array['public.glf_kyc_save(text,integer,jsonb)'::regprocedure,'public.glf_kyc_assist(uuid,integer,integer,text,jsonb,text,boolean,boolean)'::regprocedure] loop
  definition=pg_get_functiondef(fn);
  execute replace(definition,'2026-10-25.2','2026-10-26.3');
 end loop;
end;$version$;
notify pgrst,'reload schema';
commit;
`;
await fs.writeFile('supabase/migrations/202610260019_form_usability.sql',sql);
console.log('Generated migration 019: '+fields.length+' fields; private validation only.');


