# Remaining OpsDeck Audit Checks

3 October 2026 | v2.91 | Personal device acceptance, not procedure approval

## 1. iPad Offline and Restricted Wi-Fi

1. On normal internet, open OpsDeck from its Home Screen icon, sign in and confirm v2.91. Open GPS, LVTO and any other private guidance needed. In Settings, run Check offline readiness and confirm the required resources, including both PDF backups, show Prepared.
2. Use non-operational sample progress: tick one GPS and one LVTO action, and enter a recognisable FDP example. Do not reset an active operational checklist just for this test.
3. Close the app without signing out. Enable Flight Mode with Wi-Fi off, reopen from the icon and confirm the checklists, saved ticks and FDP inputs remain available without a new sign-in. Download both PDFs while offline and open them from Files.
4. Change a tick while offline, close and reopen again. Confirm that change was saved. Repeat after an overnight interval to check more than an immediate reopening.
5. When restricted BA Wi-Fi is available, connect after the app has been prepared. Try opening both checklists, saving a tick and downloading each cached PDF. Confirm a failed refresh does not erase current content or progress, leave a permanent loading screen or prevent using the cached tools. A paused-sync banner is expected.
6. If iPadOS blocks the Home Screen launch before OpsDeck opens, use the already accepted disconnect/reopen/reconnect workaround. Report it separately from an in-app loading failure; the workaround is not a requirement for the initial website to work through a blocked network.
7. Restore normal internet and confirm newer local inputs/ticks remain intact. Report orientation, approximate launch delay, any error text and whether the PDFs opened. A screenshot or short recording is useful only for a failure.

Pass: prepared tools and PDFs work without internet, offline edits survive reopening and the longer interval, and connectivity changes do not replace newer progress or block cached content. This checks observed device behaviour, not indefinite storage retention by iPadOS. Do not sign out, clear website data or remove the Home Screen app during this test.

VoiceOver and an external keyboard need checking only if Ben uses them. If used, verify that actions and state are announced clearly, modal focus stays in the open dialogue and controls can be reached and activated. Otherwise record these input methods as outside Ben's use rather than blocking completion of the touch-based acceptance check.

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
