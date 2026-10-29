-- LOCAL TEST ONLY: one team, one profile, an admin team lead and an analyst.
insert into public.tracker_teams (name, sort_index) values ('Test Team', 0) on conflict do nothing;
insert into public.tracker_profiles (name, sort_index) values ('Test Profile', 0) on conflict do nothing;
insert into public.tracker_users (user_id, name, role, email, password, team_name, team_names, is_admin, profile_names) values
  ('1', 'Local Admin', 'teamLead', 'admin@local.test', 'localtest123', 'Test Team', '["Test Team"]', true, '["Test Profile"]'),
  ('2', 'Local Analyst', 'analyst', 'analyst@local.test', 'localtest123', 'Test Team', '["Test Team"]', false, '["Test Profile"]')
on conflict (user_id) do nothing;
