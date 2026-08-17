# Ben's OpsDeck To-Do

## Current Status

- Current visible app version: v2.30.
- The top navigation has been simplified to `Jumpseat` and `FDP & LTOT`, with Jumpseat sub-tabs now `Today` and `Add`.
- Empty Jumpseat days now use a compact message with a direct `Add request` shortcut.
- LTOT detailed missing-input/status banner was removed again in v2.13 to keep the calculator visually lighter; result cards use the simpler required-input wording.
- LTOT calculation logic has been extracted into a shared helper with automated tests for rollover, standalone on-chocks, discretion, contingency, and missing FDP input.
- A guarded `Send LTOT` Telegram action has been prepared; the button only appears once the deployed Supabase function advertises LTOT summary support.
- Latest on-chocks now works as a standalone gross-check tool after Duty start time, Maximum FDP, and optional Commander's discretion are entered.
- LTOT now has a plain-English FDP lookup workflow using London/local departure airport wording, a line-by-line B/D/X selection step, tappable Table 2/Table 3 values, and a B/D/X examples pop-up.
- v2.23 clarifies the 2-hour Table 1 trigger, displays the operationally applicable time-difference ranges, and explains elapsed rotation time with a New York example.
- v2.24 adds a London-specific direct-to-Table-2 guidance band, clarifies B/D/X workflow wording, and moves elapsed-time guidance into a compact information panel.
- v2.25 integrates the no-more-than-2-hours London case into Table 1 as a compact blue `Local` row and tightens the three-step lookup wording.
- v2.26 releases focus from LTOT time and duration selectors when the user taps elsewhere, preventing a completed selector from remaining active on iPad.
- v2.27 adds an optional cabin crew FDP calculation. Flight crew and cabin crew retain independent duty start, Maximum FDP and Commander's discretion inputs, while shared final-sector timings produce an explicit limiting-crew comparison, including split reports either side of midnight.
- v2.28 limits the touch target for FDP and final-sector time selectors to the controls themselves, so tapping unused space in a timing row dismisses rather than reopens the iOS picker.
- v2.29 adds persistent individual crew limits while preserving the simple Flight crew/Cabin crew flow: up to 2 Flight crew and 6 Cabin crew records, individual Commander's discretion, joint-limit handling, targeted FDP-table selection, a named limiting-crew comparison and Telegram summary, plus protected local/cloud synchronisation.
- v2.30 introduces the refined executive light appearance and a matching graphite Night appearance. Automatic, Light and Night are selectable in Settings and remembered locally on each device without entering cloud data.
- Latest on-chocks includes a live countdown and Commander’s discretion note when discretion is used.
- Midnight rollover has been tested, including latest takeoff and latest on-chocks showing the next Zulu day with `+1`.
- Telegram reminder database tables and Edge Function have been added for fixed 75-minute jumpseat reminders.
- Telegram setup now lives under Settings, with a realistic sample reminder test message.
- Supabase Cron is active every 5 minutes, using pg_net with a 30-second timeout.
- Live Telegram reminder test passed on 23 July 2026: BA123 sent at `09:35:02Z`.
- Telegram reminder wording now uses British date format, removes the redundant timing line, and includes notes directly when present.
- The current day-to-day workflow is considered well optimised; further functional additions should be driven by operational use rather than added speculatively.

## Next Priorities

- Telegram testing: continue live operational testing and confirm device notifications arrive reliably.
- Operational testing: use the app non-operationally alongside the normal BA/manual process, then note anything that slows the user down, is easy to misread, or feels clumsy.
- Backup system: add a daily GitHub Actions backup of Supabase data, ideally into a private or otherwise secure backup location.
- LTOT reference data: add the exact BA AOMA reference wording/numbering if it differs from `OMA 7.7 Table 2`.
- Multi-crew operational testing: verify real split-report and individual-discretion scenarios on iPad and confirm that the comparison identifies the expected limiting crew member.
- FDP lookup redesign: later consider a guided OMA lookup beside Maximum FDP, while retaining the full tables for manual verification.
- FDP elapsed-time helper: consider optional first-report and next-report date/time inputs that calculate the elapsed Table 1 column without attempting to automate complex acclimatisation states.
- Jumpseat real-use polish: review whether BA ID, queue ordering, search, and daily view are showing exactly what is needed during actual requests.
- Login reliability: keep watching Supabase magic-link rate limits and mobile sign-in behaviour; consider tuning settings or relying more on password sign-in if magic links remain awkward.
- Day export/copy option: consider copying a clean text summary of jumpseat requests for messaging or email.
- Code organisation audit: separate Jumpseat and LTOT logic more clearly before adding more tools.

## Future Considerations (Deliberately Deferred)

- Scheduled on-chocks: optionally enter the scheduled on-chocks time in Zulu and show the planned margin against the controlling latest on-chocks time. This would be informational only and must handle midnight rollover correctly.
- BA form status: optionally add a single `BA form submitted` status per flight, shown discreetly in green on the flight card.
- Telegram behaviour: if BA form status is added, decide whether a completed flight should suppress the 75-minute reminder or receive a brief confirmation instead.
- LTOT scope: retain one agreed calculation snapshot without revision history unless operational experience demonstrates a genuine need for multiple revisions.
- Multi-crew date scope: clock-only report times currently use nearest-day alignment and assume all final-sector crew reports are no more than 12 hours apart. Add explicit dates before extending this workflow to long-haul patterns outside that assumption.
