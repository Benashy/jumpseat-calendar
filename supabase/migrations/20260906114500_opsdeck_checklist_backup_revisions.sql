alter table public.opsdeck_checklist_backups
  drop constraint opsdeck_checklist_backups_pkey;

alter table public.opsdeck_checklist_backups
  add primary key (user_id, checklist_key, content_sha256);

comment on table public.opsdeck_checklist_backups is
  'Private, version-matched PDF backups for authenticated OpsDeck checklists. Previous revisions remain available while an in-progress checklist update is postponed.';
