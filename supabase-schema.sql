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
