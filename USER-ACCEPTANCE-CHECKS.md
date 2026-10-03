# Remaining OpsDeck Audit Checks

3 October 2026 | v2.92 | Personal device acceptance, not procedure approval

## Results Recorded on 3 October 2026

- Ben's physical iPad: Home Screen launch and sign-in passed. GPS/LVTO remained accessible in Flight Mode with Wi-Fi off; GPS ticking and unticking survived repeated close/reopen cycles, and the latest selections were retained after reconnecting. Both checklist PDFs downloaded and opened offline. These are Ben's observed results, not a second independent device test.
- Readiness: Ben reran the check and confirmed every resource now shows Prepared in green, including App and calculators. This device check passes. The earlier Not confirmed indication is no longer reproduced; its exact cause was not established. Current v159 shell checks also passed online/offline in isolated Chromium and WebKit and rejected a deliberately incomplete test cache. No storage clearing or reinstall was required.
- Actual backup: the v2.91 file exported at 11:58:32Z passed schema validation and isolated restore, re-export and close/reopen comparisons in both Chromium and WebKit. Its one saved crew-limit row and final-sector inputs matched exactly. It contains zero Jumpseat requests and was exported before Ben created the TEST request, so this file does not verify restoration of a real populated Jumpseat list. No live account data was changed and the restore contexts made no external requests.
- Telegram: Ben confirmed the original reminder for the 13:30Z TEST departure arrived on schedule, approximately 75 minutes before departure, and subsequently confirmed the snoozed repeat arrived as expected approximately 15 minutes after his tap. Both ordinary delivery and single-tap snooze checks pass on his device report. No precise message timestamp or independent delivery-log check is claimed. The optional rapid double-tap exercise was not performed; it does not block this personal-use acceptance check.
- Still pending: restricted BA Wi-Fi and overnight/longer reopening. Ben has deleted the TEST request and confirms VoiceOver/external-keyboard testing is not relevant to his use. He also reports FDP/LTOT inputs have persisted overnight in previous testing, without claiming a new extended-duration GPS/LVTO test on this release. The accepted disconnect/reopen/reconnect workaround remains available for restricted Wi-Fi.
- Small UX proposals, not implemented: make Settings reachable consistently from the tool views, rename Export JSON to Download data backup, and make the readiness panel's whole-app scope clearer. No additional procedure content or app release is implied by this test report.
- Approved v2.92 timing behaviour: GPS/LVTO start a fresh checklist on the next opening/resume after six hours since a deliberate checklist change, independently for each tool, with an amber explanation. Full reset includes ticks, not-applicable choices, hidden sections and entered LVTO values/decisions, but preserves prepared content/PDFs and access. There is no timer that silently clears an on-screen checklist. FDP/LTOT show a dismissible caution 15 hours after the first entry, retain all inputs, and keep that original timestamp despite later edits. Dismissal persists until Reset starts a new calculation. Legacy data without a first-entry timestamp starts tracking on the next deliberate edit. A 24-hour FDP/LTOT wipe is not implemented.

## 1. iPad Offline and Restricted Wi-Fi

1. On normal internet, open OpsDeck from its Home Screen icon, sign in and confirm v2.92. Open GPS, LVTO and any other private guidance needed. In Settings, run Check offline readiness and confirm the required resources, including both PDF backups, show Prepared.
2. Use non-operational sample progress: tick one GPS and one LVTO action, and enter a recognisable FDP example. Do not reset an active operational checklist just for this test.
3. Close the app without signing out. Enable Flight Mode with Wi-Fi off, reopen from the icon and confirm the checklists, saved ticks and FDP inputs remain available without a new sign-in. Download both PDFs while offline and open them from Files.
4. Change a tick while offline, close and reopen again within six hours. Confirm that change was saved. Repeat after more than six hours without changing either checklist: each should open as a complete fresh checklist with an amber inactivity notice. Guidance and both PDFs must still work offline. FDP/LTOT inputs remain retained; after 15 hours from their first entry, the caution appears. Dismiss it, reopen and confirm it stays dismissed without changing inputs. Reset should clear both inputs and the warning clock.
5. When restricted BA Wi-Fi is available, connect after the app has been prepared. Try opening both checklists, saving a tick and downloading each cached PDF. Confirm a failed refresh does not erase current content or progress, leave a permanent loading screen or prevent using the cached tools. A paused-sync banner is expected.
6. If iPadOS blocks the Home Screen launch before OpsDeck opens, use the already accepted disconnect/reopen/reconnect workaround. Report it separately from an in-app loading failure; the workaround is not a requirement for the initial website to work through a blocked network.
7. Restore normal internet and confirm newer local inputs/ticks remain intact. Report orientation, approximate launch delay, any error text and whether the PDFs opened. A screenshot or short recording is useful only for a failure.

Pass: prepared tools and PDFs work without internet, offline edits survive reopening within six hours, and older checklist progress resets visibly on return after six hours. FDP/LTOT inputs remain retained with the separate 15-hour dismissible caution. Connectivity changes do not replace newer progress or block cached content. This checks observed device behaviour, not indefinite storage retention by iPadOS. Do not sign out, clear website data or remove the Home Screen app during this test.

Ben confirmed on 3 October that VoiceOver and an external keyboard are not relevant to his use. They are outside the required personal-device acceptance checks, without claiming physical accessibility testing was performed.

## 2. Backup and Telegram

### Backup

In Settings, choose Export JSON. Keep the original file separate from the app and provide a copy in this private Codex chat. Verify its schema and perform a controlled restore in an isolated local test copy, with cloud writes disabled, then compare Jumpseat records and FDP/LTOT inputs. Do not use Restore JSON on Ben's live account for the test: it replaces current account data and can synchronise that replacement.

Pass: the exported file is valid and the isolated restored records/inputs match, allowing for the documented seven-day request retention. JSON covers Jumpseat and FDP/LTOT, not checklist ticks, private guidance or PDF downloads. The latter are checked in the offline exercise above. Do not upload the backup to a public issue, repository or third-party validator.

### Telegram

1. On normal internet, create one clearly labelled TEST Jumpseat request with at least one named request entry and a departure about 90 minutes in the future, using the correct Zulu date/time. Confirm it has synchronised. This is a temporary test record, not a real booking.
2. Confirm exactly one scheduled reminder arrives approximately 75 minutes before that departure, about 15 minutes after creating the example. Record the arrival time.
3. Tap Snooze 15 minutes and confirm one repeat arrives approximately 15 minutes later. If testing duplicate taps, two rapid taps must not create two repeats. Allow for the once-a-minute scheduler; do not expect delivery to the exact second.
4. Remove the TEST request after the check and report the original/reminder-repeat times and any duplicate message or failure. Do not alter or remove real requests.

Pass: one scheduled original and one snoozed repeat, with no duplicate delivery. Settings' Send sample reminder checks immediate delivery and formatting only; it does not exercise the schedule or include the actual reminder's snooze action.

## Items Removed from This Audit's Active List

- F-G/S verification: handled by Ben and his technical pilot. Preserve the current red warning until a separately authorised, source-backed content/PDF update.
- Hosting migration for framing headers: not proportionate solely for this personal app; retain the technical limitation in SECURITY.md without claiming it is fixed.
- Further code reorganisation: optional internal maintenance, not a user-visible capability or a prerequisite to using this release.
