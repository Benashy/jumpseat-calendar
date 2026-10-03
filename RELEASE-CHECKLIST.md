# OpsDeck Release Checks

## Every release

1. Read the current worktree and preserve unrelated changes. Keep private procedures, PDF bytes, credentials and real test records out of public source and artifacts.
2. Record whether operational wording changes. For a GPS or LVTO wording change, update the PDF from the same approved source, visually inspect it, and publish both private records together. Interface-only changes do not require a new PDF.
3. Run `supabase/check-private-release.sql` through the authorised database connection. Save its metadata-only JSON result outside the repository. Run `node scripts/check-private-release.mjs <result.json>` against `checklist-release.json`. A mismatched or missing PDF blocks release. Update the manifest only after verification, not to silence a failure.
4. Use `pnpm install --frozen-lockfile --ignore-scripts`. Increment the release, then run `pnpm run prepare:release` after the last app edit. This regenerates inline-script CSP hashes and exact offline-file digests.
5. Run `pnpm run check`, `pnpm run check:reliability` and `pnpm run test:browser`. Repeat with `BROWSER_ENGINE=webkit`. Review screenshots on iPad landscape, portrait, split view and iPhone, including night mode. Automated accessibility checks do not replace VoiceOver and real-device testing.
6. The GitHub Pages source must be **GitHub Actions**, not branch publishing. The publish job must depend on successful validation. The artifact is built from the offline-shell allow-list, not the whole repository.
7. Check deployed `release.json`, HTML, scripts, CSP and service-worker hashes against the tested commit. Verify anonymous private-data denial and owner-filtered access after backend changes. Do not test by modifying real crew records or sending reminders.
8. Check Settings, This device, then reopen on the actual iPad without connectivity. Test an existing signed-in trusted device separately from explicit sign-out. Keep GPS and LVTO Under test until Ben changes that status.

## Failure cases in the automated suite

- Missing LVTO decision/minimum, conditional action revalidation and completed-state changes.
- Storage quota/getter failure, legacy owner migration, explicit sign-out and late auth writes.
- Late cloud reads, refresh while typing and account/session changes.
- HTTP errors, HTTP-200 captive portal, hung requests, verified cache use and unavailable origin.
- Modal containment, keyboard tabs, contrast, responsive widths and CSP compatibility.
- Source/PDF byte-integrity rejection and preservation of valid private caches.
- Offline PDF download byte comparison, account/revision isolation and explicit sign-out removal.

## Current limits

The private content/PDF parity check requires an authorised connection and is a local release gate, not a public CI query. CI uses synthetic procedure text only. Physical iPad launch, storage retention and VoiceOver need real-device confirmation. Restricted Wi-Fi may still prevent iPadOS from launching the website before the service worker runs; the accepted disconnect/reopen/reconnect workaround remains relevant.
