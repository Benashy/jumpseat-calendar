create table if not exists public.jumpseat_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requests jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.jumpseat_data enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.jumpseat_data to authenticated;

drop policy if exists "Users can read their own jumpseat data" on public.jumpseat_data;
drop policy if exists "Users can insert their own jumpseat data" on public.jumpseat_data;
drop policy if exists "Users can update their own jumpseat data" on public.jumpseat_data;

create policy "Users can read their own jumpseat data"
on public.jumpseat_data
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own jumpseat data"
on public.jumpseat_data
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own jumpseat data"
on public.jumpseat_data
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.opsdeck_calculator_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.opsdeck_calculator_state enable row level security;

revoke all on public.opsdeck_calculator_state from anon;
revoke all on public.opsdeck_calculator_state from authenticated;
grant select, insert, update on public.opsdeck_calculator_state to authenticated;

drop policy if exists "Users can read their own calculator state" on public.opsdeck_calculator_state;
drop policy if exists "Users can insert their own calculator state" on public.opsdeck_calculator_state;
drop policy if exists "Users can update their own calculator state" on public.opsdeck_calculator_state;

create policy "Users can read their own calculator state"
on public.opsdeck_calculator_state
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own calculator state"
on public.opsdeck_calculator_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own calculator state"
on public.opsdeck_calculator_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.opsdeck_notoc_policy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  policy_version text not null,
  mapping jsonb not null check (jsonb_typeof(mapping) = 'array'),
  mapping_sha256 text not null,
  mobility_policy jsonb,
  mobility_policy_sha256 text,
  updated_at timestamptz not null default now()
);

alter table public.opsdeck_notoc_policy
  add column if not exists mobility_policy jsonb,
  add column if not exists mobility_policy_sha256 text;

alter table public.opsdeck_notoc_policy
  drop constraint if exists opsdeck_notoc_policy_mobility_policy_object,
  add constraint opsdeck_notoc_policy_mobility_policy_object
    check (mobility_policy is null or jsonb_typeof(mobility_policy) = 'object'),
  drop constraint if exists opsdeck_notoc_policy_mobility_policy_sha256_format,
  add constraint opsdeck_notoc_policy_mobility_policy_sha256_format
    check (mobility_policy_sha256 is null or mobility_policy_sha256 ~ '^[0-9a-f]{64}$');

alter table public.opsdeck_notoc_policy enable row level security;

revoke all on public.opsdeck_notoc_policy from anon;
revoke all on public.opsdeck_notoc_policy from authenticated;
grant select on public.opsdeck_notoc_policy to authenticated;
grant select, insert, update, delete on public.opsdeck_notoc_policy to service_role;

drop policy if exists "Users can read their own NOTOC policy" on public.opsdeck_notoc_policy;

create policy "Users can read their own NOTOC policy"
on public.opsdeck_notoc_policy
for select
to authenticated
using ((select auth.uid()) = user_id);

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.opsdeck_telegram_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id text,
  chat_label text,
  username text,
  enabled boolean not null default false,
  pairing_code text,
  pairing_expires_at timestamptz,
  linked_at timestamptz,
  test_sent_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.opsdeck_telegram_settings enable row level security;

grant select, insert, update on public.opsdeck_telegram_settings to authenticated;
grant select, insert, update on public.opsdeck_telegram_settings to service_role;

drop policy if exists "Users can read their own Telegram settings" on public.opsdeck_telegram_settings;
drop policy if exists "Users can insert their own Telegram settings" on public.opsdeck_telegram_settings;
drop policy if exists "Users can update their own Telegram settings" on public.opsdeck_telegram_settings;

create policy "Users can read their own Telegram settings"
on public.opsdeck_telegram_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own Telegram settings"
on public.opsdeck_telegram_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own Telegram settings"
on public.opsdeck_telegram_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create table if not exists public.jumpseat_reminder_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flight_key text not null,
  flight_date date not null,
  flight_number text not null,
  departure_time text not null,
  reminder_offset_minutes integer not null default 75,
  scheduled_departure_at timestamptz not null,
  reminder_due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'error')),
  message text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.jumpseat_reminder_runs enable row level security;

create unique index if not exists jumpseat_reminder_runs_once_per_flight
on public.jumpseat_reminder_runs (user_id, flight_key, reminder_offset_minutes);

grant select on public.jumpseat_reminder_runs to authenticated;
grant select, insert, update on public.jumpseat_reminder_runs to service_role;
grant select on public.jumpseat_data to service_role;

drop policy if exists "Users can read their own reminder runs" on public.jumpseat_reminder_runs;

create policy "Users can read their own reminder runs"
on public.jumpseat_reminder_runs
for select
to authenticated
using ((select auth.uid()) = user_id);

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

create index if not exists jumpseat_reminder_snoozes_user_id
on public.jumpseat_reminder_snoozes (user_id);

create index if not exists jumpseat_reminder_snoozes_reminder_run_id
on public.jumpseat_reminder_snoozes (reminder_run_id);

alter table public.jumpseat_reminder_snoozes enable row level security;

revoke all privileges on table public.jumpseat_reminder_snoozes from anon;
revoke all privileges on table public.jumpseat_reminder_snoozes from authenticated;
grant select, insert, update, delete on table public.jumpseat_reminder_snoozes to service_role;

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end
$$;
