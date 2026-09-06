# OpsDeck v2.80 GPS and offline QA

## Automated checks

- Trusted offline identity accepts only a valid account ID and is removed on sign-out.
- GPS and LVTO restore validated, account-specific checklist copies without making a network request.
- Checklist hashes are recalculated before cached wording is accepted.
- PDF downloads require an online connection, the signed-in owner's row and the content hash of the checklist currently open.
- PDF bytes must have a valid PDF signature and matching SHA-256 digest before download.
- Anonymous PDF access, other-account reads and authenticated browser writes are denied.

## GPS content checks

- The GPS deselection route is shown beneath each relevant action as `DATA > POSITION MONITOR > SEL NAVAIDS > GPS DESELECT`.
- After landing shows separate GPS selection verification, GPWS TERR reinstatement, IRS, e-log and ASR actions.
- The two Ben-authorised handover checks use the established vertical gold rule; they are not presented as BA or Airbus procedure items.
- GPWS SYS and CLOCK are not added to the after-landing sequence.
- Next-departure ground preparation is separated from the preceding flight by a visible phase divider.
- GPS remains marked `Under test`.

## Responsive checks

Checked in browser emulation at 1024 x 1366, 1194 x 834 and 390 x 844. No horizontal page overflow or clipped headings, controls or action text was found.

## Remaining physical-device check

On the intended iPad, sign in online and open both private checklists once. Close OpsDeck, enable Flight Mode with Wi-Fi disabled, reopen the installed site and confirm both checklists load and retain new ticks. This is the final device-specific confirmation because browser storage retention and installed-site behaviour cannot be proved by desktop emulation.
