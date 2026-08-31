# GPS Checklist UI Review, v2.67

## Scope

Presentation and section visibility only. No procedural text, policy payload, source hash, database permissions or other tool calculations changed. Source references and context remain in the authenticated, owner-scoped offline copy, but are no longer rendered at the bottom of the checklist.

## Automated Verification

- Full suite: 193 tests passed, including 25 GPS tests.
- Every section can be hidden, including sections with legacy `canHide: false` source metadata. Linked arrival and ground-preparation groups remain linked.
- Only preliminary cockpit preparation, cockpit preparation and unexpected interference are amber. Other sections default to red, including any future section. Aggregate alerts count actual sections, with red precedence.
- Hidden and restored sections retain their ticks. New checklist and Clear ticks retain their existing confirmation behaviour. Partial linked groups restore visibly.
- Owner/hash isolation, offline cache validation, failed storage, source-update confirmation and preserved progress remain covered.
- Updated timestamp uses recorded progress time in UTC, including midnight and date rollover.
- Public UI does not render reference/context drawers, global completion counts or per-section completion counts.

## Browser Verification

Local preview uses the actual private source payload, not synthetic procedural text. No live checklist ticks were changed.

- Light: 1180 x 820, 1024 x 768, 820 x 1180, 744 x 1133, 390 x 844, 375 x 812 and 1440 x 900.
- Night: iPad landscape and iPhone portrait.
- No horizontal page overflow, clipped control text or action/section tap targets below 44 px at the checked sizes.
- Actual hidden badges: one amber, mixed red/amber, linked ground sections, all ten sections hidden, and restore-all.
- Individual hidden headings remain visible and restore the corresponding section/group when selected.
- Reload preserves a checked action, hidden choices and the updated timestamp.
- Disclosure font, weight, spacing and triangle match FDP/LTOT. Hidden-pill type size, weight, padding, radius and theme colours match the existing limit pills.
- No bottom References panel or completion counters in the rendered DOM.

Browser size emulation is not a physical iPad/iPhone test. Ben's next real-device use remains the final touch/offline check.

## Release Checks

Release validation, published-asset comparison and signed-in live rendering are checked after publication. No source-content migration is required, so this UI update does not reset an active checklist.
