create table public.opsdeck_lvto_checklist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  checklist jsonb not null check (jsonb_typeof(checklist) = 'object'),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz not null default now()
);

alter table public.opsdeck_lvto_checklist enable row level security;
revoke all on public.opsdeck_lvto_checklist from public, anon, authenticated;
grant select on public.opsdeck_lvto_checklist to authenticated;
grant select, insert, update, delete on public.opsdeck_lvto_checklist to service_role;

create policy "Owners can read their LVTO checklist"
  on public.opsdeck_lvto_checklist for select to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.opsdeck_lvto_checklist is
  'Private source checklist. Content is provisioned separately, never bundled in public app assets.';
