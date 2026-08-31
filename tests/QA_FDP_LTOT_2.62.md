# FDP and LTOT v2.62 verification

Date: 31 August 2026. All interactive checks used disposable local-preview data, not the live account.

## Automated coverage

- Explicit UTC report dates, including report gaps exceeding 12 hours, month rollover and invalid/missing dates.
- A report entered late in the day stays on the chosen date rather than moving to tomorrow.
- Legacy saved-date migration, calculator export-format round trips and persistent crew numbering after deletion/reload.
- Reset and cancellation preserve the intended date, numbering and data behaviour.
- Main and compact result states agree at normal, 30-minute, exceeded and expired boundaries.
- Table targeting, optional names, crew caps, joint limits and existing calculation regressions.
- Syntax, DOM references and release/cache consistency.

## Rendered browser checks

- iPad-sized landscape: 1024 x 768 and 1180 x 820. All three critical results remain side by side. Report date/time, FDP and discretion fit the landscape input row.
- iPad-sized portrait: 820 x 1180. Date/time occupy their own row above FDP and discretion.
- iPhone-sized portrait: 390 x 844, 375 x 812, and 320 x 740. No page overflow. Native date/time controls stack at widths of 380 px or less.
- Desktop: 1440 x 900.
- Light and Night results, amber approaching-limit states, red exceeded states, discretion and limiting badges.
- Table recipients and sector headings remain visible during vertical scrolling; pinned and actual column positions match after horizontal scrolling.
- Selecting values updates the chosen group or individual, including returning from an individual to the original group.
- An incomplete additional entry clears final results until it is completed or removed.
- Removing an earlier individual does not renumber the remaining individual. Labels and dates survive reload.
- Joint results use compact labels while the comparison retains every identity and individual discretion value.
- Tapping outside a time control releases focus.
- Standalone on-chocks use keeps unused pushback/takeoff cards compact on phones.
- No console warnings or errors were recorded in the tested preview.

## Boundaries and device follow-up

These are responsive Chromium checks, not physical iPad/iPhone Safari certification. The browser automation connection stalled during a native reset confirmation; reset and cancel behaviour are covered by automated tests, but the native confirmation still needs a physical-device check.

On both devices, load v2.62, check the report dates on restored entries, then verify the native date/time picker, tap-away dismissal, reset confirmation and table scrolling. Existing saved anchors are preserved, not corrected by guessing the user's intended duty date. Update both devices before continuing cross-device edits.

No database, authentication, permissions, Telegram service or aviation reference rules were changed in this release. Full live cross-device sync and physical offline-launch checks were not repeated during this UI pass.
