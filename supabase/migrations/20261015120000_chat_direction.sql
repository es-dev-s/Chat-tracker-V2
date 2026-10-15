-- Chat direction (inbound / outbound) on ledger rows.
-- Nullable so existing rows and older clients keep working; the API requires it on new records.
alter table public.chat_records
  add column if not exists chat_direction text;

alter table public.chat_records
  drop constraint if exists chat_records_chat_direction_check;

alter table public.chat_records
  add constraint chat_records_chat_direction_check
  check (chat_direction is null or chat_direction in ('in', 'out'));

comment on column public.chat_records.chat_direction is
  'Device used on the chat: ''in'' or ''out'' (shown as Device In / Out). Null on legacy rows.';

notify pgrst, 'reload schema';
