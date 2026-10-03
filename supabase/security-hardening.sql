-- Product audit: preserve all existing owner-scoped read/write permissions.
revoke truncate, trigger, references
  on public.jumpseat_data, public.jumpseat_reminder_runs, public.opsdeck_telegram_settings
  from anon, authenticated;

-- New public objects require explicit client grants alongside their RLS policies.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
