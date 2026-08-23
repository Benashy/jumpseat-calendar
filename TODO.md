# Ben's OpsDeck To-Do

## Current Status

- Current visible app version: v2.51.
- The top navigation contains `Jumpseat`, `FDP & LTOT` and `Tools`. Tools opens a dedicated landing view for the Radio Altimeter Position Check and NOTOC, while Jumpseat retains contextual `Add request` and `Back to requests` actions.
- Empty Jumpseat days use a compact message, with the persistent `Add request` action held in the day summary.
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
- v2.31 replaces the gold selected-state detail on the Jumpseat, FDP & LTOT, Today and Add controls with a restrained silver finish.
- v2.32 restores the simpler FDP workflow: one Flight crew limit and one optional Cabin crew limit, with no individual crew records. Calculator persistence, limiting-group comparison and Telegram output remain in place.
- v2.33 reduces Jumpseat navigation height, progressively reveals the completed crew comparison, simplifies FDP input framing, aligns final-sector controls, improves mobile comparison readability, standardises touch and focus states, and refines icons, contrast and numerical typography.
- v2.34 anchors live FDP and LTOT countdowns to a Zulu calendar date, including correct next-day countdowns across midnight and an expired-calculation warning after 12 hours.
- v2.34 protects locally changed Jumpseat data during interrupted saves, retries cloud writes automatically, and presents both copies for an explicit choice if another device has changed the same data.
- v2.34 adds portable JSON backup and restore plus a readable Jumpseat CSV export under Settings. Authentication and Telegram credentials are deliberately excluded from exports.
- v2.34 adds bounded Telegram reminder retries, a wider recovery window, and persistent attempt tracking for short-lived delivery failures.
- v2.34 adds a repeatable release manifest, automated DOM/release/calculation checks on GitHub, and a documented rollback point at v2.33.
- v2.34 gives sign-in fields persistent visible labels and replaces infrastructure wording in Telegram Settings with plain service status wording.
- v2.35 automatically deletes Jumpseat requests and OpsDeck Telegram delivery records after seven complete days. The app applies the same Zulu-date rule to local and offline copies, while delivered Telegram messages remain in the user's Telegram account.
- v2.36 clarifies the optional split-crew FDP workflow with shared/separate crew wording and gives the FDP table target banner a cleaner silver divider and spacing in Light and Night appearances.
- v2.37 introduces the BA pilot-wings identity across the app header, favicon and iPhone/iPad home-screen icons, using flat vector artwork and a fresh cache marker.
- v2.38 adds a development-only Radio Altimeter Position Check for a flat-terrain estimate at the first 2,500 ft RA indication. It stores no data, remains available offline and is explicitly not an altitude to fly.
- v2.38 adds a development-only NOTOC Assistant with separate cross-check, code lookup, mobility-aid battery and signature-explanation journeys. Unknown or unverified information is referred rather than inferred, and operational session data is not persisted.
- v2.39 corrects the right pilot-wing geometry in the header wordmark, favicon and iPhone/iPad home-screen icons so every wing bar meets the sloping `A` cleanly.
- v2.40 simplifies the development RA and NOTOC tools: RA uses defaulted elevation and temperature selectors, geometric slant distance and a strict below-ISA-minus-25 warning; NOTOC retains only code lookup and mobility-aid battery checks, with the removed journeys and internal policy version no longer shown.
- v2.41 adds a responsive RA geometry diagram, a guided one-question-at-a-time mobility-aid battery check with review summary, and searchable SHC/DG suggestions that remain limited to verified policy-pack entries while unsupported codes continue to refer.
- v2.42 consolidates RA and NOTOC under a responsive Checks landing view, restricts RA temperature input to -25 through +50 degrees Celsius, and compares the selected nominal glide slope with the temperature-affected barometric indication. Repetitive NOTOC lookup caveats have been removed without changing the cautious unknown-code referral logic.
- v2.43 renames Checks to Tools, standardises RA input-unit labels, gives cold and warm temperature profiles distinct blue and red treatments with clearer visual separation, and removes repetitive helper copy from the NOTOC battery journey.
- v2.44 adds a fixed dashed 3.0-degree RA reference, hides temperature-profile differences below 50 ft at 2,500 ft RA, clarifies that the displayed DME is measured on the selected glide slope, and simplifies the mobility-aid battery journey with a neutral Yes/No opening and only decision-relevant stowage information.
- v2.45 stores the BA NOTOC code library in a read-only, user-owned Supabase row rather than the public website repository. The authenticated library is cached per user on each device for offline lookup and removed from the running app on sign-out.
- v2.45 loaded the initial private SHC/DG mapping with explicit verification states.
- v2.45 expands the verified `ICE` entry with the documented 2.5 kg per-person passenger/crew baggage allowance, approval, venting, marking and AVI segregation requirements. Cargo, aircraft, hold and compartment quantity limits remain explicitly unknown pending the current CDGM.
- v2.46 removes undocumented codes from the private library, leaving 92 entries: 45 current-manual verified codes and 47 codes whose NOTOC expectation still requires verification. It also enlarges the iPad RA diagram, keeps exact calculated values while reducing visual path-length compression, shortens labels, and shows the dashed 3.0-degree comparison only outside the 2.8 to 3.3 degree band.
- v2.47 adds a duplicate-protected `Snooze 15 minutes` action to scheduled Jumpseat Telegram reminders, moves bot pairing to the same verified Telegram webhook, and checks the server-side snooze queue every minute.
- v2.47 adds a structured BA mobility-aid battery policy extraction brief. The battery tool remains on its cautious referral path until the required current BA evidence is returned and reviewed.
- v2.48 stores the reviewed 15-branch BA mobility-aid battery policy privately in Supabase and replaces the earlier generic battery questions with a one-question-at-a-time Captain's cross-check. Dry-cell and non-spillable wet batteries remain separate, missing or conflicting handling and NOTOC information is explicit, and any branch with incomplete internal evidence continues to refer.
- v2.49 scopes the Radio Altimeter Position Check to ILS terminology, keeps temperature compensation confined to the expected QNH indication, and corrects the diagram so temperature cannot appear to move the physical glide slope. It also supports a DME reference at, before or beyond the threshold and keeps threshold geometry separate from the expected DME indication.
- v2.50 simplifies the mobility-aid battery journey around observable operational facts. It removes visible evidence drawers and unknown-answer buttons, separates exact code lookup from the battery check, confirms NOTOC content and the final loadsheet directly, and replaces development-state referrals with `No obvious inconsistency identified`, `Confirm before signing` or `Possible discrepancy` outcomes. Items outside the passenger mobility-aid provision now receive a specific acceptance-route action.
- v2.51 limits the visible SHC/DG library to the 45 codes with a verified BA NOTOC yes/no outcome while retaining all unresolved records privately. Required codes are amber, verified not-expected codes are green, and explicit documented inconsistencies are red. It also adds a verified-code browser, removes repetitive lookup boilerplate, gives non-passenger mobility aids a distinct stop route, prevents sticky iPad hover selection, and simplifies the RA DME-reference presentation.
- Latest on-chocks includes a live countdown and Commander’s discretion note when discretion is used.
- Midnight rollover has been tested, including latest takeoff and latest on-chocks showing the next Zulu day with `+1`.
- Telegram reminder database tables and Edge Function have been added for fixed 75-minute jumpseat reminders.
- Telegram setup now lives under Settings, with a realistic sample reminder test message.
- Supabase Cron is active every minute, using pg_net with a 30-second timeout.
- Live Telegram reminder test passed on 23 July 2026: BA123 sent at `09:35:02Z`.
- Telegram reminder wording now uses British date format, removes the redundant timing line, and includes notes directly when present.
- The current day-to-day workflow is considered well optimised; further functional additions should be driven by operational use rather than added speculatively.

## Next Priorities

- Radio Altimeter release gate: independently verify the ten specified manual references, confirm the current OMA cold-weather trigger, compare the complete validation matrix with the BA Cold Weather Calculator, and obtain pilot/OMC review before removing the development label.
- NOTOC release gate: verify the 47 documented code entries whose NOTOC expectation is not yet confirmed, complete Dangerous Goods/SME review, and repeat operational offline/device testing before removing the development label.
- NOTOC policy maintenance: retain stable rule and source IDs, record the effective date and revision of every verified source, and keep unsupported codes on the referral path until the mapping is complete.
- Mobility-aid battery operational review: use v2.50 cautiously alongside current BA documentation, record where questions or outcomes do not match the real NOTOC workflow, and obtain Dangerous Goods/SME review before treating the result as anything beyond a Captain's consistency check.

- Telegram testing: confirm an ordinary scheduled reminder arrives once with the snooze button, a single tap produces one repeat about 15 minutes later, and a rapid double tap cannot schedule two repeats.
- Backup verification: download a JSON backup, retain it somewhere separate, and perform a controlled restore test using non-operational sample data.
- Operational testing: use the app non-operationally alongside the normal BA/manual process, then note anything that slows the user down, is easy to misread, or feels clumsy.
- LTOT reference data: add the exact BA AOMA reference wording/numbering if it differs from `OMA 7.7 Table 2`.
- Split-crew operational testing: verify real Flight crew/Cabin crew report differences on iPad and confirm that the comparison identifies the expected limiting group.
- FDP lookup redesign: later consider a guided OMA lookup beside Maximum FDP, while retaining the full tables for manual verification.
- FDP elapsed-time helper: consider optional first-report and next-report date/time inputs that calculate the elapsed Table 1 column without attempting to automate complex acclimatisation states.
- FLS, FINAL APP and selected FPA research is a separate future project. These modes remain outside the OpsDeck ILS calculation unless their geometry, temperature behaviour and position reference can be verified independently against suitable Airbus and BA sources.
- Jumpseat real-use polish: review whether BA ID, queue ordering, search, and daily view are showing exactly what is needed during actual requests.
- Login reliability: keep watching Supabase magic-link rate limits and mobile sign-in behaviour; consider tuning settings or relying more on password sign-in if magic links remain awkward.
- Day export/copy option: consider copying a clean text summary of jumpseat requests for messaging or email.
- Code organisation audit: separate Jumpseat and LTOT logic more clearly before adding more tools.

## Security Workstream (Separate Approval Required)

- Supabase access: review every app table and Row Level Security policy, then verify that anonymous visitors and any unrelated account cannot read, create, update or delete Ben's records.
- Account access: disable public sign-up after confirming Ben's existing login and account-recovery route work correctly.
- Authentication and sessions: review password, magic-link, redirect URL, session lifetime, sign-out and lost-device behaviour on iPhone and iPad.
- Telegram protection: review the browser-to-Edge-Function authentication path, Cron authentication, permitted origins and pairing behaviour without exposing the bot token or Cron secret.
- Secrets: inventory and rotate sensitive Supabase, Telegram and deployment credentials where appropriate; confirm that privileged keys exist only in protected server-side or GitHub secret storage.
- Personal data: seven-day active retention is implemented for Jumpseat requests and OpsDeck reminder records; review exported backups and any remaining logs so they do not retain unnecessary personal information.
- Password protection: review the Supabase warning that leaked-password protection is disabled and decide whether to enable it during the separate authentication phase.
- Front-end protection: review third-party scripts, dependency pinning, Content Security Policy and available GitHub Pages security headers without reducing iPhone or iPad reliability.
- Private automated backup: design a daily encrypted or private Supabase backup using protected credentials, with clear retention and no personal data committed to the public repository.
- Recovery test: restore a backup into an isolated test environment and verify record counts, calculator state and Jumpseat data before treating the backup system as complete.
- Security verification: run a focused post-change review of database policies, authentication, Edge Functions, browser code and realistic attack paths, then record any accepted residual risks.

## Future Considerations (Deliberately Deferred)

- Scheduled on-chocks: optionally enter the scheduled on-chocks time in Zulu and show the planned margin against the controlling latest on-chocks time. This would be informational only and must handle midnight rollover correctly.
- BA form status: optionally add a single `BA form submitted` status per flight, shown discreetly in green on the flight card.
- Telegram behaviour: if BA form status is added, decide whether a completed flight should suppress the 75-minute reminder or receive a brief confirmation instead.
- LTOT scope: retain one agreed calculation snapshot without revision history unless operational experience demonstrates a genuine need for multiple revisions.
- Multi-crew date scope: clock-only report times currently use nearest-day alignment and assume all final-sector crew reports are no more than 12 hours apart. Add explicit dates before extending this workflow to long-haul patterns outside that assumption.
