alter table public.chat_records
  add column if not exists amount_to_pay text not null default '',
  add column if not exists required_documents text not null default '',
  add column if not exists class_session_date text not null default '',
  add column if not exists class_session_time text not null default '',
  add column if not exists class_session_instructions text not null default '';

comment on column public.chat_records.amount_to_pay is
  'Amount to be paid for payment follow-up. Free-text so currency and formatting can vary.';
comment on column public.chat_records.required_documents is
  'Documents required from the client for the main team lead follow-up.';
comment on column public.chat_records.class_session_date is
  'Scheduled date for a client class session reminder.';
comment on column public.chat_records.class_session_time is
  'Scheduled time for a client class session reminder.';
comment on column public.chat_records.class_session_instructions is
  'Instructions or additional information for a client class session.';

notify pgrst, 'reload schema';