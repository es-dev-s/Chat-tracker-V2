-- ============================================================================
-- CLOUD SUPABASE SCRIPT: Payment Records payment type (CT-13)
-- Paste into Supabase Dashboard -> SQL Editor -> Run, BEFORE deploying the code.
-- Same content as supabase/migrations/20261126120000_payment_records_type.sql.
-- ============================================================================

-- Payment Records: one payment per record (CT-13).
-- The form now takes a single Payment Date, a Payment Type and one amount.
-- The app writes the date to from_date and to_date and the amount to total_amount
-- (plus initial_amount or final_amount for its type), so existing constraints still hold.
-- Old rows get a type: final when only a final amount was recorded, else initial.
-- Safe to run more than once.
alter table public.payment_records add column if not exists payment_type text;

update public.payment_records
set payment_type = case when final_amount > 0 and initial_amount = 0 then 'final' else 'initial' end
where payment_type is null;

alter table public.payment_records alter column payment_type set default 'initial';
alter table public.payment_records alter column payment_type set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payment_records_type_check') then
    alter table public.payment_records
      add constraint payment_records_type_check check (payment_type in ('initial', 'final'));
  end if;
end $$;

notify pgrst, 'reload schema';
