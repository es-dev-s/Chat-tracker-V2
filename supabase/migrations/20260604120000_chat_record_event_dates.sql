-- Per-milestone calendar dates for cross-day reply tracking (nullable = use chat_records.date).

alter table public.chat_records
  add column if not exists first_receive_date text,
  add column if not exists first_reply_date text,
  add column if not exists client_last_reply_date text,
  add column if not exists analyst_last_reply_date text;

comment on column public.chat_records.first_receive_date is 'YYYY-MM-DD for 1st receive; null uses date column';
comment on column public.chat_records.first_reply_date is 'YYYY-MM-DD for 1st reply; null uses date column';
comment on column public.chat_records.client_last_reply_date is 'YYYY-MM-DD for client last reply; null uses date column';
comment on column public.chat_records.analyst_last_reply_date is 'YYYY-MM-DD for analyst last reply; null uses date column';
