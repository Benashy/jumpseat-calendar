-- OpsDeck Telegram reminder scheduler.
--
-- Run this only after:
-- 1. OPSDECK_TELEGRAM_BOT_TOKEN is set in Edge Function secrets.
-- 2. OPSDECK_CRON_SECRET is set in Edge Function secrets.
-- 3. Telegram pairing and Send test work from OpsDeck.
--
-- Replace CHANGE_ME_CRON_SECRET with the same private value used for OPSDECK_CRON_SECRET.
-- This schedules the reminder checker every 5 minutes and gives the Edge Function
-- a 30-second timeout to allow for occasional cold starts.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

select vault.create_secret(
  'https://kztwizifuhuvbccyycdm.supabase.co',
  'opsdeck_project_url'
);

select vault.create_secret(
  'CHANGE_ME_CRON_SECRET',
  'opsdeck_cron_secret'
);

select cron.unschedule('opsdeck-jumpseat-reminders-every-5-minutes')
where exists (
  select 1
  from cron.job
  where jobname = 'opsdeck-jumpseat-reminders-every-5-minutes'
);

select cron.schedule(
  'opsdeck-jumpseat-reminders-every-5-minutes',
  '*/5 * * * *',
  $$
  select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'opsdeck_project_url' order by created_at desc limit 1) || '/functions/v1/opsdeck-telegram',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-opsdeck-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'opsdeck_cron_secret' order by created_at desc limit 1)
      ),
      body := '{"action":"run_jumpseat_reminders"}'::jsonb,
      timeout_milliseconds := 30000
    ) as request_id;
  $$
);
