-- Run once in Supabase SQL Editor (safe to re-run). Adds 'Left as seen' category.
alter table public.chat_records drop constraint if exists chat_records_reply_timing_check;
alter table public.chat_records add constraint chat_records_reply_timing_check check (reply_timing is null or reply_timing in ('same_day','next_morning','after_12pm_next_day','main_cases','sunday_only','left_as_seen'));
do $$ begin
  if to_regclass('public.whatsapp_audits') is not null then
    alter table public.whatsapp_audits drop constraint if exists whatsapp_audits_category_check;
    alter table public.whatsapp_audits add constraint whatsapp_audits_category_check check (category is null or category in ('same_day','next_morning','after_12pm_next_day','main_cases','sunday_only','left_as_seen'));
  end if;
end $$;
notify pgrst, 'reload schema';
