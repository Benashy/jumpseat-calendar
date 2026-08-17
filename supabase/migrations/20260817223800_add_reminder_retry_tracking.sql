-- Track bounded reminder retries for short-lived Telegram delivery failures.
alter table public.jumpseat_reminder_runs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamp with time zone,
  add column if not exists next_attempt_at timestamp with time zone;

update public.jumpseat_reminder_runs
set
  attempt_count = greatest(attempt_count, 1),
  last_attempt_at = coalesce(last_attempt_at, created_at)
where attempt_count = 0;

alter table public.jumpseat_reminder_runs
  drop constraint if exists jumpseat_reminder_runs_attempt_count_check;

alter table public.jumpseat_reminder_runs
  add constraint jumpseat_reminder_runs_attempt_count_check
  check (attempt_count between 0 and 3);

create index if not exists jumpseat_reminder_runs_retry_queue
  on public.jumpseat_reminder_runs (status, next_attempt_at)
  where status in ('pending', 'error');
