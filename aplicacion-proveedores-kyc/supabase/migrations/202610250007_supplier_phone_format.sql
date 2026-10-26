begin;
alter table public.glf_suppliers add constraint glf_supplier_primary_phone_format check(length(phone)<=50 and phone ~ '[0-9]' and phone ~ '^[+0-9(). -]+$');
commit;
