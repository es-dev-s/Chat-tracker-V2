alter table public.chat_records
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by text;

comment on column public.chat_records.acknowledged_at is
  'When a main team lead acknowledged this chat record. Null until acknowledged.';
comment on column public.chat_records.acknowledged_by is
  'Email of the main team lead who acknowledged this chat record.';

notify pgrst, 'reload schema';
