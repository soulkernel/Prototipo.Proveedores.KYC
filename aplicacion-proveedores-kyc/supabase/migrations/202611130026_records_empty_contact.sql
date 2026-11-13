-- A linked supplier already provides its commercial contact. Do not add empty contacts.
begin;
do $migration$
declare definition text; marker text := 'if p_data ? ''contact'' then';
begin
 definition := pg_get_functiondef('public.glf_records(text,uuid,integer,jsonb)'::regprocedure);
 if strpos(definition,marker)=0 then raise exception 'Unexpected correspondence function version';end if;
 definition := replace(definition,marker,
  'if p_data ? ''contact'' and length(trim(concat_ws('''',p_data->''contact''->>''name'',p_data->''contact''->>''job_title'',p_data->''contact''->>''email'',p_data->''contact''->>''phone'')))>0 then');
 execute definition;
end;
$migration$;
commit;
