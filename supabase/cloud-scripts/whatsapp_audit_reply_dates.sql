-- Run once in the Supabase SQL Editor (cloud). Idempotent: safe to run again.
-- The app keeps working before this runs (dates just are not stored).
-- WhatsApp Audit: optional calendar dates for "Client Msg Received" and "Reply Time".
-- NULL means "not recorded" (older rows): received = audit_date, and the reply
-- day is inferred from the clock times (after midnight = next day).
-- Safe to run more than once. Only adds nullable columns to whatsapp_audits.
alter table public.whatsapp_audits
  add column if not exists client_msg_date date,
  add column if not exists reply_date date;

alter table public.whatsapp_audits
  drop constraint if exists whatsapp_audits_reply_date_order_check;
alter table public.whatsapp_audits
  add constraint whatsapp_audits_reply_date_order_check
  check (reply_date is null or client_msg_date is null or reply_date >= client_msg_date);

notify pgrst, 'reload schema';

-- Check it worked (no error expected):
-- select client_msg_date, reply_date from public.whatsapp_audits limit 1;
