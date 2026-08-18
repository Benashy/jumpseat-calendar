create table if not exists public.opsdeck_notoc_policy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  policy_version text not null,
  mapping jsonb not null check (jsonb_typeof(mapping) = 'array'),
  mapping_sha256 text not null,
  updated_at timestamptz not null default now()
);

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
