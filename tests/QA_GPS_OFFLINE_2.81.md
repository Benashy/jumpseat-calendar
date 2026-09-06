# OpsDeck v2.81 GPS and offline QA

## Automated checks

- Trusted offline identity accepts only a valid account ID and is removed on sign-out.
- GPS and LVTO restore validated, account-specific checklist copies without making a network request.
- Checklist hashes are recalculated before cached wording is accepted.
- PDF downloads require an online connection, the signed-in owner's row and the content hash of the checklist currently open.
- PDF bytes must have a valid PDF signature and matching SHA-256 digest before download.
- Anonymous PDF access, other-account reads and authenticated browser writes are denied.
- GPS and LVTO expose only `New checklist`; the confirmed action clears each checklist's complete working state.

## GPS content checks

- The GPS deselection route is shown beneath each relevant action as `DATA > POSITION MONITOR > SEL NAVAIDS > GPS DESELECT`.
- After landing shows separate GPS selection verification, GPWS TERR reinstatement, IRS, e-log and ASR actions.
- The two Ben-authorised handover checks use the established vertical gold rule; they are not presented as BA or Airbus procedure items.
- GPWS SYS and CLOCK are not added to the after-landing sequence.
- Next-departure ground preparation is separated from the preceding flight by a visible phase divider.
- GPS remains marked `Under test`.

## Responsive checks

Checked in browser emulation at 1024 x 1366, 1194 x 834 and 390 x 844. No horizontal page overflow or clipped headings, controls or action text was found.

## Physical iPad result

Passed on 6 September 2026 using the installed Home Screen app in Flight Mode with Wi-Fi disabled. GPS and LVTO loaded from their validated private caches, retained existing ticks and saved new ticks across repeated app closures and launches. NOTOC guidance and code lookup, FDP/LTOT and the RA position check remained available. Jumpseat remained readable with online writes disabled, and PDF downloads were disabled offline as designed.

## Remaining physical-device checks

- Repeat the trusted-device launch on the restricted BA Wi-Fi with mobile data disabled, where the iPad may report a connection although GitHub Pages or Supabase cannot be reached.
- Capture the enlarged top-left Home Screen launch in a screenshot, with iPad model, iPadOS version and orientation.
