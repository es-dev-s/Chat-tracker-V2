-- Payment Records: add client details. total_amount stays (the app now stores initial + final).
-- client_name is required by the app; old rows keep an empty value. client_number is optional.
-- Safe to run more than once.
alter table public.payment_records add column if not exists client_name text not null default '';
alter table public.payment_records add column if not exists client_number text not null default '';
notify pgrst, 'reload schema';
