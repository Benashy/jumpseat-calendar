# September Product Audit Implementation

## 3 October 2026: Audit Completion

Published: v2.91, cloud-sync-143, offline cache v159. The main audit release was v2.90; v2.91 aligns the RA shortcut wording. Accepted launch appearance unchanged. The focused v2.89 GPS warning renderer, source validation and regression tests have been reconciled into this checkout.

New work in this pass:

- Private PDF backups are automatically verified and cached when a checklist opens online. Matching saved PDFs can be downloaded offline. Owner changes, source changes and late responses cannot cross the account/revision boundary. Explicit sign-out clears active-owner checklist progress and PDF copies as well as guidance.
- A discreet Previous checklist restored label appears for non-empty restored progress and disappears on the next deliberate edit. New checklist remains the only complete reset.
- Offline readiness checks include both private PDF copies. Storage failures do not claim PDF persistence.
- Current GPS/LVTO private source and PDF digests match the release manifest. Operational wording and PDF content are unchanged; Under test and the pending F-G/S verification note remain.
- Live public registration is disabled and leaked-password protection is enabled, verified through the dashboard and security advisor. No paid upgrade or credential change.
- GitHub Pages now uses GitHub Actions, so publishing must wait for the validation job and its allow-listed artifact.

Verification: 263 unit/regression tests, exact CSP/shell checks and 43 browser checks in each of Chromium and WebKit passed, including real offline PDF downloads with byte comparison. Real-content layout checks passed 72 configurations in each engine with no overflow or automated accessibility findings. The pinned dependency lockfile installation and private source/PDF manifest check passed.

Publication completed at release commit `45d7a530834423ea724b631f682a1aa2bbaf4496`. Actions run `37117238832` passed validation and publication. All 34 distinct public files matched the tested local bytes on 3 October 2026; six excluded development/private-release paths returned 404, six anonymous private-data reads returned 401, and public registration remained disabled. The matching private GPS/LVTO checklist and PDF digests were verified separately. This evidence does not replace the remaining physical-device or operational checks.

The final v2.91 release at `3c86d96d8a812a0dfd3e86ebddd82f648921b825` passed Actions run `37118056477` and live byte/access checks on 3 October 2026.

Active outstanding audit checks are now limited to Ben's physical iPad/offline PDF and restricted-Wi-Fi checks, plus the controlled backup and scheduled Telegram/snooze check. `USER-ACCEPTANCE-CHECKS.md` records the steps and expected results. VoiceOver and external-keyboard testing are relevant only if Ben uses those input methods. Browser results do not promise indefinite iPadOS storage retention or constitute independent aviation/SME approval.

Ben is handling the F-G/S question with a technical pilot, so it is removed from this task's outstanding list; the red source-verification warning is not removed. Hosting migration for framing headers and further code reorganisation are not necessary for this release and are removed from the active list. The lack of server-enforced framing headers remains an accepted, documented hosting limitation rather than a completed security control.

Final visual-review refinement: v2.91 changes the RA Tools shortcut from Expected to Estimated, matching the result wording. Calculation logic, launch behaviour and private checklist/PDF content remain unchanged.

## Focused GPS release, 18 September 2026

v2.89 is now published independently at `6916f0f4c62ab3e5ed8532507ebfc90e0bf96dba` from `../jumpseat-gps-verification`. It adds standalone red pending-verification notes to the GPS renderer. The private GPS checklist and matching PDF were updated together; the FLS vertical-guidance statement now awaits BA/Airbus verification rather than implying permission. Under test remains.

Historical boundary: the product-audit frontend changes were parked separately from this release. They have now been reconciled for v2.90 as recorded above. The focused release passed 238 tests and 16 day/night responsive browser configurations; full offline reload passed in Chromium, with WebKit layout and cached-content restoration checked separately.

Private implementation evidence and the revised PDF are in the workspace `output/gps-verification-2026-09-18` directory. The canonical GPS backup PDF was also refreshed. No auth, permissions, launch logic or publishing-configuration change was included in this focused release.

## Historical parking note, 8 September 2026

Ben needs to leave and use the current app. Do not rush publication. Live release.json was checked again and remains v2.88 (cloud-sync-140, cache v156). The v2.89 frontend changes are saved locally, not committed, pushed or published. Backend least-privilege hardening and Telegram v13 are already live and verified.

Final browser runs passed 41 checks in Chromium and 41 in WebKit, including the expanded offline-readiness panel in both appearance modes, after fixing its night-mode contrast. Those test servers and browser processes have finished. The previous complete unit/regression run passed 252 tests; rerun it because one storage-probe test was added afterwards. No change to private operational wording or PDF content was made.

Resume with final unit/reliability checks, visual inspection of the final readiness screenshots, the metadata-only private-release validation script, public build verification and release review. Supabase dashboard permission and GitHub Pages source configuration remain unresolved. The GitHub settings browser was signed out; the Supabase dashboard navigation was denied and must not be bypassed. The official configure-pages action explicitly requires a token other than GITHUB_TOKEN for enablement, so do not assume that action can switch the repository settings with the workflow token. Resolve the supported deployment path before committing/publishing the test-gated workflow. Do not claim the account-registration/password settings or server-enforced framing protection are complete.

## Implemented

- LVTO completion includes the return decision, applicable conditional actions and the minimum needed for its computed display. Optional annotation fields remain optional. Material input changes invalidate their dependent acknowledgements, not unrelated actions. A short reason explains an incomplete state.
- Owner-scoped local storage and explicit offline sign-out replace the old unscoped private cache. Storage exceptions retain current inputs in memory and show a persistent warning instead of stopping startup or claiming a save.
- Cloud reads use current local state after awaiting a response and check the owner, session and request generation. Refresh cannot erase input typed while the response was pending. Existing cloud conflict handling remains.
- Verified complete offline shell, bounded network requests, no caching of block pages, selective cache cleanup and deliberate in-app update activation.
- Larger, higher-contrast Under test badges; modal focus containment and restoration; keyboard navigation for tabs; consistent settings spacing.
- Actual NOTOC digest verification, preserving the existing verified cached export. Private PDF digests match the unchanged live GPS/LVTO content.
- Strict backup shape, date, time, count and size checks before replacement; spreadsheet-formula protection for CSV; explicit scope for JSON backups.
- Separate saved-data status for Jumpseat and FDP/LTOT, on-demand offline readiness and a content-free diagnostic export.
- Storage, authentication-storage, network and focus helpers separated from app orchestration. Pinned test packages and lockfile; pinned Telegram Supabase import deployed as Edge Function version 13.
- Repeatable unit, fault-injection, responsive, accessibility and real service-worker tests. Publishing workflow depends on validation and packages only allow-listed public files. Updated rollback and private-content release checklist.
- Applied and verified least-privilege database hardening. An unrelated authenticated identity returns no private rows. Telegram still rejects unauthenticated requests.

## Administrative follow-through

The previously outstanding dashboard settings were completed and verified on 3 October 2026: public registration disabled, leaked-password protection enabled, and GitHub Pages switched to Actions. Existing users and recovery routes are retained.

Server-enforced framing protection is not available through this GitHub Pages configuration. On 3 October 2026 it was removed from the active work list as a disproportionate reason by itself to migrate this personal app. No hosting migration or weakening of existing controls has been made.

## Verification boundary

Browser simulation is not a physical iPad sign-off or validation of BA/Airbus procedures. Under test remains. Run the final release commands after any subsequent source edit; the exact-byte manifest intentionally rejects stale generated files.
