create table public.opsdeck_checklist_backups (
  user_id uuid not null references auth.users(id) on delete cascade,
  checklist_key text not null check (checklist_key ~ '^[a-z][a-z0-9-]{0,79}$'),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  filename text not null check (filename ~ '^[A-Za-z0-9][A-Za-z0-9 ._()-]{0,158}\.pdf$'),
  pdf_sha256 text not null check (pdf_sha256 ~ '^[a-f0-9]{64}$'),
  pdf_base64 text not null check (octet_length(pdf_base64) between 8 and 2800000),
  updated_at timestamptz not null default now(),
  primary key (user_id, checklist_key)
);

alter table public.opsdeck_checklist_backups enable row level security;
revoke all on public.opsdeck_checklist_backups from public, anon, authenticated;
grant select on public.opsdeck_checklist_backups to authenticated;
grant select, insert, update, delete on public.opsdeck_checklist_backups to service_role;

create policy "Owners can read their checklist backups"
  on public.opsdeck_checklist_backups for select to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.opsdeck_checklist_backups is
  'Private, version-matched PDF backups for authenticated OpsDeck checklists.';
