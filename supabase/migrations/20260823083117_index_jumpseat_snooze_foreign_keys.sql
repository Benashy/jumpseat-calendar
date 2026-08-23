create index if not exists jumpseat_reminder_snoozes_user_id
on public.jumpseat_reminder_snoozes (user_id);

create index if not exists jumpseat_reminder_snoozes_reminder_run_id
on public.jumpseat_reminder_snoozes (reminder_run_id);
