-- WhatsApp Audit: shift and client message captured on Log Chat.
-- Safe to run more than once. Existing rows get empty strings; nothing else changes.
alter table public.chat_records
  add column if not exists shift text not null default '',
  add column if not exists client_message text not null default '';

comment on column public.chat_records.shift is
  'Analyst shift for this chat, e.g. "3 to 7". Shown on the WhatsApp Audit page.';
comment on column public.chat_records.client_message is
  'The client''s message for this chat. Shown on the WhatsApp Audit page.';

notify pgrst, 'reload schema';
