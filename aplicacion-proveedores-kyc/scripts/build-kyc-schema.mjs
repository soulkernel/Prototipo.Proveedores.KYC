import fs from 'node:fs/promises';
import {fields} from '../src/kyc-model.js';
const sql=String.raw`
create function glf_kyc_private.fields() returns jsonb language sql immutable set search_path='' as $fields$ select '${JSON.stringify(fields).replaceAll("'","''")}'::jsonb $fields$;
create function glf_kyc_private.applies(f jsonb,a jsonb) returns boolean language sql immutable set search_path='' as $$
 select not exists(select 1 from jsonb_each(coalesce(f->'when','{}')) w where not coalesce(w.value ? (a->>w.key),false));
$$;
create function glf_kyc_private.project(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare a jsonb:=p;r jsonb:='{}';f jsonb;o jsonb;owners jsonb:='[]';
begin
 if a->>'relation' in('staff','board') then a=jsonb_set(a,'{person}','"natural"');end if;
 if a->>'person'='legal' then a=jsonb_set(a,'{idType}',to_jsonb(case when a->>'country'='EC' then 'ruc' else 'tax_id' end));
 elsif a->>'country'='EC' then a=jsonb_set(a,'{idType}','"cedula"');elsif coalesce(a->>'idType','') not in('passport','foreign_id') then a=jsonb_set(a,'{idType}','"passport"');end if;
 for f in select value from jsonb_array_elements(glf_kyc_private.fields()) loop
 if glf_kyc_private.applies(f,a) then r=r||jsonb_build_object(f->>'key',trim(coalesce(a->>(f->>'key'),'')));end if;end loop;
 if a->>'person'='legal' and jsonb_typeof(a->'owners')='array' then
 for o in select value from jsonb_array_elements(a->'owners') limit 30 loop owners=owners||jsonb_build_array(jsonb_build_object('name',trim(coalesce(o->>'name','')),'pct',coalesce(o->>'pct',''),'country',trim(coalesce(o->>'country','')),'id',trim(coalesce(o->>'id',''))));end loop;end if;
 return r||jsonb_build_object('person',coalesce(a->>'person',''),'owners',owners);
end;$$;
create function glf_kyc_private.validate(p jsonb) returns text[] language plpgsql stable set search_path='' as $$
declare a jsonb:=glf_kyc_private.project(p);f jsonb;v text;errs text[]:='{}';o jsonb;total numeric:=0;
begin
 for f in select value from jsonb_array_elements(glf_kyc_private.fields()) loop
 if not glf_kyc_private.applies(f,a) then continue;end if;v=coalesce(a->>(f->>'key'),'');
 if (coalesce((f->>'required')::boolean,false) and v='') or length(v)>coalesce((f->>'max')::integer,250) or (v<>'' and f ? 'options' and not (f->'options' ? v)) then errs=array_append(errs,f->>'key');end if;
 if v<>'' then
 if f->>'type'='email' and v !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then errs=array_append(errs,f->>'key');end if;
 if f->>'type'='tel' and (v !~ '[0-9]' or v !~ '^[+0-9(). -]+$') then errs=array_append(errs,f->>'key');end if;
 if f->>'type'='country' and v !~ '^[A-Z]{2}$' then errs=array_append(errs,f->>'key');end if;
 if f->>'type'='number' and v !~ '^[0-9]+(\.[0-9]{1,2})?$' then errs=array_append(errs,f->>'key');end if;
 if f->>'type'='date' and (v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or v>current_date::text) then errs=array_append(errs,f->>'key');end if;
 end if;end loop;
 if a->>'country'='EC' and ((a->>'person'='legal' and a->>'id' !~ '^[0-9]{13}$') or (a->>'person'='natural' and a->>'id' !~ '^[0-9]{10}$')) then errs=array_append(errs,'id');end if;
 if a->>'invoice'='yes' and a->>'country'='EC' and a->>'taxId' !~ '^[0-9]{13}$' then errs=array_append(errs,'taxId');end if;
 if a->>'person'='legal' then
 if jsonb_array_length(a->'owners')=0 and coalesce(a->>'ownershipExplanation','')='' then errs=array_append(errs,'ownershipExplanation');end if;
 for o in select value from jsonb_array_elements(a->'owners') loop
 if coalesce(o->>'name','')='' or coalesce(o->>'id','')='' or o->>'country' !~ '^[A-Z]{2}$' or length(o->>'name')>250 or length(o->>'id')>60 then errs=array_append(errs,'owners');end if;
 if o->>'pct' !~ '^[0-9]+(\.[0-9]{1,2})?$' then errs=array_append(errs,'owners');else
 if (o->>'pct')::numeric<10 or (o->>'pct')::numeric>100 then errs=array_append(errs,'owners');end if;total=total+(o->>'pct')::numeric;end if;
 end loop;if total>100.001 then errs=array_append(errs,'owners');end if;end if;return errs;
end;$$;
create function glf_kyc_private.documents(p jsonb) returns text[] language plpgsql immutable set search_path='' as $$
declare a jsonb:=glf_kyc_private.project(p);r text[]:=array['signed','identity'];i integer;
begin
 if a->>'relation' in('staff','board') then return r||array['cv'];end if;r=r||array['bank','address_doc'];
 if a->>'person'='legal' then r=r||array['tax','appointment'];for i in 0..jsonb_array_length(a->'owners')-1 loop r=array_append(r,'owner_'||i);end loop;end if;return r;
end;$$;
`;
const template=await fs.readFile('scripts/kyc-schema-template.sql','utf8');
await fs.writeFile('supabase/migrations/202610250008_kyc_cases.sql',template.replace('-- MODEL_FUNCTIONS',()=>sql));
console.log('KYC migration generated from shared form rules');

