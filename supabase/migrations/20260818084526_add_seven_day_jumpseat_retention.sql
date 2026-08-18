create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create or replace function private.purge_expired_opsdeck_data()
returns table (
  cutoff_date date,
  request_rows_updated bigint,
  requests_removed bigint,
  reminder_runs_removed bigint
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_cutoff_date date := (now() at time zone 'UTC')::date - 7;
  v_request_rows_updated bigint := 0;
  v_requests_removed bigint := 0;
  v_reminder_runs_removed bigint := 0;
begin
  with filtered as (
    select
      data.user_id,
      coalesce(
        jsonb_agg(entry.item order by entry.position)
          filter (
            where not (
              entry.item->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
              and entry.item->>'date' < v_cutoff_date::text
            )
          ),
        '[]'::jsonb
      ) as retained_requests,
      count(*) filter (
        where entry.item->>'date' ~ '^\d{4}-\d{2}-\d{2}$'
          and entry.item->>'date' < v_cutoff_date::text
      )::bigint as removed_count
    from public.jumpseat_data as data
    cross join lateral jsonb_array_elements(data.requests) with ordinality as entry(item, position)
    group by data.user_id
  ),
  updated as (
    update public.jumpseat_data as data
    set
      requests = filtered.retained_requests,
      updated_at = now()
    from filtered
    where data.user_id = filtered.user_id
      and filtered.removed_count > 0
    returning filtered.removed_count
  )
  select
    count(*)::bigint,
    coalesce(sum(updated.removed_count), 0)::bigint
  into
    v_request_rows_updated,
    v_requests_removed
  from updated;

  delete from public.jumpseat_reminder_runs
  where flight_date < v_cutoff_date;
  get diagnostics v_reminder_runs_removed = row_count;

  return query
  select
    v_cutoff_date,
    v_request_rows_updated,
    v_requests_removed,
    v_reminder_runs_removed;
end;
$function$;

revoke all on function private.purge_expired_opsdeck_data() from public, anon, authenticated;

do $schedule$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'opsdeck-data-retention-daily'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'opsdeck-data-retention-daily',
    '17 2 * * *',
    'select * from private.purge_expired_opsdeck_data();'
  );
end;
$schedule$;
