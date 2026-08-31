# GPS Checklist v2.66 Verification

## Scope

New manual checklist under Tools. Existing calculator, radio-altimeter, NOTOC and Telegram logic is unchanged. Private source text is provisioned separately and is not included in this repository or its test fixtures.

## Automated Checks

- Source shape, unique IDs, safe text rendering and deterministic SHA-256 validation.
- All items initially unticked; ticks reversible; annotations cannot be ticked.
- Only explicitly grouped alternative outcomes replace one another, with confirmation in the UI.
- Linked visibility, required sections, hidden items excluded from visible counts, restoration of retained ticks.
- Account-scoped cache/progress, malformed cache, changed source, source-update postponement, stale requests following sign-out or account changes.
- Offline cached source, failed refresh, storage failure, confirmed reset and separate clear-ticks behaviour.
- Existing app regression suite, DOM contract and release consistency.

## Browser Checks

- Light: 1440x900, 1180x820, 1024x768, 820x1180, 744x1133, 390x844, 375x812.
- Night: 1180x820, 1024x768, 820x1180, 744x1133, 390x844, 375x812.
- No horizontal overflow in the GPS view at these sizes; checklist rows and disclosure targets at least 44 px high.
- Long rows, indented alternatives, source context, Tools navigation and return route.
- Ticking and reload persistence; hiding/restoring linked sections; visible hidden headings and honest progress counts.

These are browser viewport checks, not a claim of testing on physical iPad/iPhone hardware or every Safari version.

## Private Data Boundary

- GPS source table has RLS and owner-only SELECT policy.
- Anonymous role cannot read it. Authenticated owner sees one row; an unrelated authenticated identity sees zero.
- Client roles cannot insert, update or delete source content.
- Source cache and progress keys are user-scoped. Explicit sign-out clears cached source and displayed text; progress contains IDs/timestamps only.
- Existing security-advisor items remain in the separate security workstream; no new GPS-table finding.

## Remaining Device Check

After signing in and opening the checklist online, verify offline reopening on the physical iPad. Review optional sections, reset behaviour and the unchanged draft wording before relying on the workflow. Progress is local to each device and does not automatically start a new flight.

## Rollback

The previous frontend is commit e91bd5af03aea75cf054f0d3d1c0c788b0ca0dd2 (v2.65). A frontend rollback must use a new service-worker cache version. The added source table can remain private and unused; no existing table was modified.
