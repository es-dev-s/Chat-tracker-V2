create index if not exists chat_records_updated_at_idx
  on public.chat_records (updated_at desc);

create index if not exists chat_records_team_idx
  on public.chat_records (team);

create index if not exists chat_records_date_id_idx
  on public.chat_records (date desc, id desc);
