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
