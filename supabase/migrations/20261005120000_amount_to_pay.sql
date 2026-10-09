-- Dedicated payment follow-up amount on chat records.
alter table public.chat_records
  add column if not exists amount_to_pay text not null default '';

comment on column public.chat_records.amount_to_pay is
  'Amount to be paid for payment follow-up. Free-text so currency and formatting can vary.';
