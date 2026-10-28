import fs from 'node:fs/promises';
import {fields,KYC_VERSION} from '../src/kyc-model.js';
import {incomeSources} from '../src/kyc-declarations.js';
import {noteFields,noApplyFields} from '../src/kyc-requirement-notes.js';
const old=await fs.readFile('supabase/migrations/202610270021_commercial_tax_identification.sql','utf8');
const review=await fs.readFile('supabase/migrations/202610270020_optimized_form_review.sql','utf8');
let helper=review.slice(review.indexOf('create or replace function glf_kyc_private.review_list_valid'),review.indexOf('create or replace function glf_kyc_private.project'));
helper=helper.replace(/array\['salary'[^\]]*\]/,()=>`array[${incomeSources.map(o=>"'"+o[0]+"'").join(',')}]`);
let validate=old.slice(old.indexOf('create or replace function glf_kyc_private.validate'),old.indexOf('do $version$'));
validate=validate.replace(' return array(select distinct e',()=>` if a->>'relation' in('supplier','consultant') and glf_kyc_private.review_list_valid(a->>'incomeSources','sources') then
  if coalesce(nullif(a->>'incomeSources',''),'[]')::jsonb ? 'other' and coalesce(a->>'incomeOther','')='' then errs=array_append(errs,'incomeOther');end if;
 end if;
 if not glf_kyc_private.requirement_notes_valid(a->>'requirementNotes') then errs=array_append(errs,'requirementNotes');end if;
 return array(select distinct e`);
await fs.writeFile('supabase/migrations/202610270022_capture_guidance.sql',`-- Compact, guided capture; notes request review and never waive required data/documents.
-- Existing answers, signed documents and access policies are not changed.
begin;
alter table public.glf_kyc_cases alter column form_version set default '${KYC_VERSION}';
create or replace function glf_kyc_private.fields() returns jsonb language sql immutable set search_path='' as $fields$ select '${JSON.stringify(fields).replaceAll("'","''")}'::jsonb $fields$;
${helper}
create or replace function glf_kyc_private.requirement_notes_valid(v text) returns boolean language plpgsql immutable set search_path='' as $$
declare a jsonb;r jsonb;k text;seen text[]:='{}';
begin
 if coalesce(v,'')='' then return true;end if;
 a=v::jsonb;if jsonb_typeof(a)<>'array' or jsonb_array_length(a)>60 then return false;end if;
 for r in select value from jsonb_array_elements(a) loop
  if jsonb_typeof(r)<>'object' then return false;end if;k=coalesce(r->>'target','');
  if not(k=any(array[${noteFields.map(k=>"'"+k+"'").join(',')}]) or k ~ '^file:(signed|identity|tax|bank|address_doc|appointment|cv|owner_[0-9]{1,2})$') or k=any(seen) then return false;end if;
  seen=array_append(seen,k);
  if coalesce(r->>'status','') not in('unavailable','not_applicable') then return false;end if;
  if r->>'status'='not_applicable' and not(k=any(array[${noApplyFields.map(k=>"'"+k+"'").join(',')}]) or k ~ '^file:(bank|address_doc|appointment|owner_[0-9]{1,2})$') then return false;end if;
  if jsonb_typeof(r->'reason') is distinct from 'string' or length(trim(r->>'reason'))=0 or length(r->>'reason')>1000 then return false;end if;
 end loop;return true;
exception when others then return false;
end;$$;
revoke all on function glf_kyc_private.requirement_notes_valid(text) from public,anon,authenticated;
${validate}
do $version$
declare fn regprocedure;definition text;
begin
 foreach fn in array array['public.glf_kyc_save(text,integer,jsonb)'::regprocedure,'public.glf_kyc_assist(uuid,integer,integer,text,jsonb,text,boolean,boolean)'::regprocedure] loop
  definition=pg_get_functiondef(fn);execute replace(definition,'2026-10-27.5','${KYC_VERSION}');
 end loop;
 for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('glf_kyc_start','glf_kyc_start_route') loop
  definition=pg_get_functiondef(fn);execute replace(definition,'''missingInformation'',''''','''missingInformation'','''',''requirementNotes'',''''');
 end loop;
end;$version$;
notify pgrst,'reload schema';
commit;
`);
