import fs from 'node:fs/promises';
import {fields,KYC_VERSION} from '../src/kyc-model.js';
import {kinships,incomeSources} from '../src/kyc-declarations.js';
const old=await fs.readFile('supabase/migrations/202610260019_form_usability.sql','utf8');
let project=old.slice(old.indexOf('create or replace function glf_kyc_private.project'),old.indexOf('create or replace function glf_kyc_private.validate'));
let validate=old.slice(old.indexOf('create or replace function glf_kyc_private.validate'),old.indexOf('-- Keep the existing'));
validate=validate.replace("if a->>'country'='EC' and ((", "if a->>'person'='natural' and a->>'country'='EC' and a->>'idType'<>'cedula' then errs=array_append(errs,'idType');end if;\n if a->>'country'='EC' and ((");
validate=validate.replace("if v<>'' then",()=>`if f->>'type' in('sources','pepRelatives','glfRelatives') and not glf_kyc_private.review_list_valid(v,f->>'type') then errs=array_append(errs,f->>'key');end if;
 if f->>'type'='kinship' and v<>'' and v !~ '^[^<>]{1,100}$' then errs=array_append(errs,f->>'key');end if;
 if v<>'' then`);
const sql=`-- Optimized workbook review: explicit declarations, PEP, contact and missing-data notes.
-- No updates to existing cases, files, memberships, policies or grants.
begin;
alter table public.glf_kyc_cases alter column form_version set default '${KYC_VERSION}';
create or replace function glf_kyc_private.fields() returns jsonb language sql immutable set search_path='' as $fields$ select '${JSON.stringify(fields).replaceAll("'","''")}'::jsonb $fields$;
create or replace function glf_kyc_private.review_list_valid(v text,kind text) returns boolean language plpgsql immutable set search_path='' as $$
declare a jsonb;r jsonb;seen text[]:='{}';k text;
begin
 if coalesce(v,'')='' then return true;end if;
 a=v::jsonb;if jsonb_typeof(a)<>'array' or jsonb_array_length(a)>20 then return false;end if;
 if kind='sources' then
  if jsonb_array_length(a)=0 then return false;end if;
  for r in select value from jsonb_array_elements(a) loop
   k=r#>>'{}';if jsonb_typeof(r)<>'string' or not k=any(array[${incomeSources.map(o=>"'"+o[0]+"'").join(',')}]) or k=any(seen) then return false;end if;seen=array_append(seen,k);
  end loop;return true;
 end if;
 for r in select value from jsonb_array_elements(a) loop
  if jsonb_typeof(r)<>'object' then return false;end if;
  foreach k in array array['name','position'] loop
   if jsonb_typeof(r->k) is distinct from 'string' or length(trim(coalesce(r->>k,'')))=0 or length(r->>k)>250 then return false;end if;
  end loop;
  if not coalesce(r->>'relationship','')=any(array[${kinships.map(o=>"'"+o[0]+"'").join(',')}]) then return false;end if;
  if r->>'relationship'='other' and (jsonb_typeof(r->'other') is distinct from 'string' or length(trim(coalesce(r->>'other','')))=0 or length(r->>'other')>250) then return false;end if;
  if kind='pepRelatives' and (jsonb_typeof(r->'institution') is distinct from 'string' or length(trim(coalesce(r->>'institution','')))=0 or length(r->>'institution')>250 or coalesce(r->>'country','') !~ '^[A-Z]{2}$') then return false;end if;
 end loop;return true;
exception when others then return false;
end;$$;
revoke all on function glf_kyc_private.review_list_valid(text,text) from public,anon,authenticated;
${project}
${validate}
do $version$
declare fn regprocedure;definition text;
begin
 foreach fn in array array['public.glf_kyc_save(text,integer,jsonb)'::regprocedure,'public.glf_kyc_assist(uuid,integer,integer,text,jsonb,text,boolean,boolean)'::regprocedure] loop
  definition=pg_get_functiondef(fn);execute replace(definition,'2026-10-26.3','${KYC_VERSION}');
 end loop;
 -- New cycles must collect fresh consent rather than inherit the previous signature.
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('glf_kyc_start','glf_kyc_start_route') loop
  definition=pg_get_functiondef(fn);
  definition=replace(definition,'''truth'',''''','''truth'','''',''lawfulFunds'','''',''verificationConsent'','''',''missingInformation'',''''');
  execute definition;
 end loop;
end;$version$;
notify pgrst,'reload schema';
commit;
`;
await fs.writeFile('supabase/migrations/202610270020_optimized_form_review.sql',sql);
