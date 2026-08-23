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
