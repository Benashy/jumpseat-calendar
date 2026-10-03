# OpsDeck rollback

The pre-audit v2.88 reference is commit `7745ff0cf277c5b1a79be0b30d4194c6d74f0398`. Its accepted launch appearance is retained. It is not a safe wholesale rollback target for the storage and sign-out changes in v2.90.

## Normal rollback

1. Confirm the problem is caused by the latest code release, not a stale browser cache or a Supabase outage.
2. Prefer a targeted forward fix. Preserve owner-scoped storage, explicit-sign-out protection and existing calculator/checklist schemas. Do not copy private records back into the old unscoped keys.
3. Increment the release with `pnpm run release -- <version>`, then run `pnpm run prepare:release`, `pnpm run check`, `pnpm run check:reliability` and `pnpm run test:browser`.
4. Publish the tested artifact, verify its release and service-worker bytes, then check iPhone/iPad reopening. Updates downloaded during use wait for deliberate reload; a complete previous shell remains cached.

Do not reuse a cache version with different bytes. Never remove website data as a routine update instruction: doing so can remove the user's sole copy of pending work.

## Reference-only recovery

Use `git show <reference>:<path>` to inspect an earlier file. Do not force-reset the live branch.

Database migrations and Edge Function versions are separate from GitHub Pages. Review those individually before reversing them.

The September security hardening only removes unused client privileges and changes defaults for future objects. Restoring browser code does not require restoring these privileges. Telegram version 12 is the pre-pin reference; version 13 pins its Supabase dependency without changing its action handling or authentication checks.

## Calculator dates from v2.62

Calculator schema 5 stores a separate Zulu report date for each crew entry and stable display numbers. Do not roll back to a pre-v2.62 browser bundle against these saves: older code can discard those fields and reintroduce nearest-day assumptions. Prefer a forward fix that retains schema 5. Export the current calculator state before any controlled schema rollback, and preserve every explicit date when assessing the recovery.
