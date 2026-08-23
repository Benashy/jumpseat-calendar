create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.jumpseat_reminder_snoozes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_run_id uuid not null references public.jumpseat_reminder_runs(id) on delete cascade,
  chat_id text not null,
  source_message_id bigint not null,
  callback_query_id text not null,
  due_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'error')),
  attempt_count integer not null default 0
    check (attempt_count >= 0 and attempt_count <= 3),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chat_id, source_message_id),
  unique (callback_query_id)
);

create index if not exists jumpseat_reminder_snoozes_due_queue
on public.jumpseat_reminder_snoozes (status, next_attempt_at, due_at);

alter table public.jumpseat_reminder_snoozes enable row level security;

revoke all privileges on table public.jumpseat_reminder_snoozes from anon;
revoke all privileges on table public.jumpseat_reminder_snoozes from authenticated;
grant select, insert, update, delete on table public.jumpseat_reminder_snoozes to service_role;

do $secret$
declare
  secret_value text;
begin
  select decrypted_secret
    into secret_value
  from vault.decrypted_secrets
  where name = 'opsdeck_telegram_webhook_secret'
  order by created_at desc
  limit 1;

  if secret_value is null then
    secret_value := encode(extensions.gen_random_bytes(32), 'hex');
    perform vault.create_secret(secret_value, 'opsdeck_telegram_webhook_secret');
  end if;
end;
$secret$;

create or replace function public.opsdeck_telegram_webhook_secret_matches(provided_secret text)
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'opsdeck_telegram_webhook_secret'
      and decrypted_secret = provided_secret
  );
$function$;

revoke all on function public.opsdeck_telegram_webhook_secret_matches(text) from public, anon, authenticated;
grant execute on function public.opsdeck_telegram_webhook_secret_matches(text) to service_role;

create or replace function public.opsdeck_telegram_webhook_secret()
returns text
language sql
security definer
set search_path = ''
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'opsdeck_telegram_webhook_secret'
  order by created_at desc
  limit 1;
$function$;

revoke all on function public.opsdeck_telegram_webhook_secret() from public, anon, authenticated;
grant execute on function public.opsdeck_telegram_webhook_secret() to service_role;

do $schedule$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname in (
      'opsdeck-jumpseat-reminders-every-5-minutes',
      'opsdeck-jumpseat-reminders-every-minute'
    )
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'opsdeck-jumpseat-reminders-every-minute',
    '* * * * *',
    $cron$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'opsdeck_project_url' order by created_at desc limit 1) || '/functions/v1/opsdeck-telegram',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-opsdeck-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'opsdeck_cron_secret' order by created_at desc limit 1)
        ),
        body := '{"action":"run_jumpseat_reminders"}'::jsonb,
        timeout_milliseconds := 30000
      ) as request_id;
    $cron$
  );
end;
$schedule$;
