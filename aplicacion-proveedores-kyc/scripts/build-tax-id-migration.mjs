import fs from 'node:fs/promises';
import {fields,KYC_VERSION} from '../src/kyc-model.js';
const old=await fs.readFile('supabase/migrations/202610270020_optimized_form_review.sql','utf8');
let project=old.slice(old.indexOf('create or replace function glf_kyc_private.project'),old.indexOf('create or replace function glf_kyc_private.validate'));
const start=project.indexOf(" if a->>'person'='legal' then a=jsonb_set");
const end=project.indexOf(' for f in select',start);
project=project.slice(0,start)+` if a->>'relation' in('supplier','consultant') then
  if a->>'idType' in('cedula','passport','foreign_id') and trim(coalesce(a->>'id',''))<>'' then
   if trim(coalesce(a->>'taxId',''))<>'' then
    a=jsonb_set(a,'{id}',to_jsonb(trim(a->>'taxId')));
    a=jsonb_set(a,'{idType}',to_jsonb(case when a->>'country'='EC' then 'ruc' else 'tax_id' end));
   end if;
  else a=jsonb_set(a,'{idType}',to_jsonb(case when a->>'country'='EC' then 'ruc' else 'tax_id' end));end if;
 elsif a->>'country'='EC' then a=jsonb_set(a,'{idType}','"cedula"');
 elsif coalesce(a->>'idType','') not in('passport','foreign_id') then a=jsonb_set(a,'{idType}','"passport"');end if;
`+project.slice(end);
let validate=old.slice(old.indexOf('create or replace function glf_kyc_private.validate'),old.indexOf('do $version$'));
validate=validate.replace("if a->>'person'='natural' and a->>'country'='EC' and a->>'idType'<>'cedula' then errs=array_append(errs,'idType');end if;",()=>`if a->>'relation' in('supplier','consultant') then
  if a->>'idType'<>(case when a->>'country'='EC' then 'ruc' else 'tax_id' end) then errs=array_append(errs,'idType');end if;
 elsif a->>'country'='EC' then
  if a->>'idType'<>'cedula' then errs=array_append(errs,'idType');end if;
 elsif a->>'idType' not in('passport','foreign_id') then errs=array_append(errs,'idType');end if;`);
validate=validate.replace(" if a->>'invoice'='yes' and a->>'country'='EC' and a->>'taxId' !~ '^[0-9]{13}$' then errs=array_append(errs,'taxId');end if;",'');
await fs.writeFile('supabase/migrations/202610270021_commercial_tax_identification.sql',`-- Commercial primary tax identification; no bulk updates to existing answers or files.
-- Legacy personal IDs remain identifiable and require explicit correction before submission.
begin;
alter table public.glf_kyc_cases alter column form_version set default '${KYC_VERSION}';
create or replace function glf_kyc_private.fields() returns jsonb language sql immutable set search_path='' as $fields$ select '${JSON.stringify(fields).replaceAll("'","''")}'::jsonb $fields$;
${project}
${validate}
do $version$
declare fn regprocedure;definition text;
begin
 foreach fn in array array['public.glf_kyc_save(text,integer,jsonb)'::regprocedure,'public.glf_kyc_assist(uuid,integer,integer,text,jsonb,text,boolean,boolean)'::regprocedure] loop
  definition=pg_get_functiondef(fn);execute replace(definition,'2026-10-27.4','${KYC_VERSION}');
 end loop;
end;$version$;
notify pgrst,'reload schema';
commit;
`);
