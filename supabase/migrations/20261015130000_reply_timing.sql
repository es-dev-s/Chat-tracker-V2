-- Optional reply timing category on ledger rows (Log Chat dropdown).
-- Nullable: existing rows and clients that never send it keep working.
alter table public.chat_records
  add column if not exists reply_timing text;

alter table public.chat_records
  drop constraint if exists chat_records_reply_timing_check;

alter table public.chat_records
  add constraint chat_records_reply_timing_check
  check (
    reply_timing is null
    or reply_timing in (
      'same_day',
      'next_morning',
      'after_12pm_next_day',
      'main_cases',
      'sunday_only'
    )
  );

comment on column public.chat_records.reply_timing is
  'Optional reply timing: same_day, next_morning, after_12pm_next_day, main_cases, sunday_only. Null when not set.';

notify pgrst, 'reload schema';
