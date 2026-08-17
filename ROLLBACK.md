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
