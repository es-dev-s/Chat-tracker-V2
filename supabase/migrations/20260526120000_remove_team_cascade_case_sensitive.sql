-- Align legacy RPC with exact team names (case-sensitive).
-- The Next.js app performs the full cascade in TypeScript; apply this only if
-- external tools still call remove_team_cascade().

create or replace function public.remove_team_cascade(p_team_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team text := btrim(p_team_name);
begin
  if v_team is null or v_team = '' then
    raise exception 'TEAM_NAME_REQUIRED';
  end if;

  delete from public.chat_records where team = v_team;
  delete from public.tracker_users where team_name = v_team;
  delete from public.tracker_teams where name = v_team;
end;
$$;
