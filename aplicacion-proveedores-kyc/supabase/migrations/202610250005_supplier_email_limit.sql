-- Limit optional commercial email addresses to three; retain the primary email.
begin;
alter table public.glf_suppliers add constraint glf_supplier_email_limit check(jsonb_array_length(additional_emails)<=3);
commit;
