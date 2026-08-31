# OpsDeck rollback

The last known-good baseline before v2.34 is the annotated Git tag `v2.33`.

## Normal rollback

1. Confirm the problem is caused by the latest code release, not a stale browser cache or a Supabase outage.
2. Revert the faulty commit with `git revert <commit>` so history remains intact.
3. Run `npm run check`.
4. Push the revert to `main` and verify the deployed GitHub Pages site on iPhone and iPad.

## Reference-only recovery

Use `git show v2.33:<path>` to inspect or recover an individual v2.33 file. Do not force-reset the live branch.

Database migrations and Edge Function versions are separate from GitHub Pages. Review those individually before reversing them.

## Calculator dates from v2.62

Calculator schema 5 stores a separate Zulu report date for each crew entry and stable display numbers. Do not roll back to a pre-v2.62 browser bundle against these saves: older code can discard those fields and reintroduce nearest-day assumptions. Prefer a forward fix that retains schema 5. Export the current calculator state before any controlled schema rollback, and preserve every explicit date when assessing the recovery.
