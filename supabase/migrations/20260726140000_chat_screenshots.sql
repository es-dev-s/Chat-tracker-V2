-- First / last chat screenshots on ledger rows (storage paths in chat-screenshots bucket).
alter table public.chat_records
  add column if not exists first_chat_screenshot text not null default '',
  add column if not exists last_chat_screenshot text not null default '';

comment on column public.chat_records.first_chat_screenshot is
  'Storage object path for 1st chat screenshot (bucket: chat-screenshots).';
comment on column public.chat_records.last_chat_screenshot is
  'Storage object path for last chat screenshot (bucket: chat-screenshots).';
