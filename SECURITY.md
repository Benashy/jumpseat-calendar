# OpsDeck Security Boundaries

## Public and private

GitHub Pages serves public code, interface text and assets. A hidden screen is not a confidentiality boundary. BA checklist payloads, NOTOC mappings and PDF backups remain in owner-only Supabase tables, not public static files. Private tables use RLS and explicit grants; the browser has no service-role key.

New public-schema objects require explicit client grants. The September audit removed unused TRUNCATE, TRIGGER and REFERENCES grants. Server-only reminder processing retains its existing permissions. Telegram's custom user, scheduler and webhook checks remain in force; it deliberately does not rely on the platform JWT gate for incoming Telegram webhooks.

## Trusted offline devices

A successful online sign-in records the verified owner. Private local records are scoped to that owner. An offline visitor without that trusted profile can use public tools but cannot read a previous owner's saved records. Explicit sign-out removes the local session, trusted profile, active owner's private caches and drafts, and blocks late refresh-token writes. A new sign-in waits for prior SDK sign-out cleanup.

This is not local encryption or a second device lock. Someone with an unlocked, deliberately trusted iPad can use its prepared data. Protect the iPad itself. If the browser refuses storage removal, the app reports that website data needs clearing before sharing the device. Offline sign-out cannot guarantee immediate server-side revocation or invalidate already issued access tokens on other devices.

## Integrity and loading

GPS, LVTO, NOTOC and downloaded PDFs verify actual content digests. Private PDFs are cached separately by verified owner and checklist, accepted only for the currently open source hash, and removed on explicit sign-out. Their bytes never enter the public service-worker cache. Two explicitly pinned historic NOTOC export digests preserve compatibility with the verified older serialisation; modified content does not inherit that exception. Hashes detect corruption or mismatched releases, not source approval or a compromised hosting origin.

Offline installation accepts only a complete set of matching app bytes. Blocked-site pages and partial updates cannot replace it. Updates wait for deliberate activation while an app is open. Network requests have bounded timeouts. Readiness checks verify saved guidance and perform an actual local write/read/remove test, but cannot promise indefinite iPadOS storage retention.

## Browser protections

The tested meta CSP restricts scripts to this origin and exact inline launch-script hashes, limits connections to OpsDeck's Supabase project, and disallows embedded objects. No referrer is sent. Dynamic layout styling still requires inline styles. No analytics or remote error collection has been added; the optional diagnostic file omits names, tokens and checklist content.

GitHub Pages does not expose configurable response headers here. A meta CSP cannot enforce `frame-ancestors`. The remaining risk is another site embedding OpsDeck in a frame and attempting deceptive clicks, not automatic access to its private data. On 3 October 2026, a hosting migration solely for this additional protection was removed from the active work list for Ben's personal Home Screen use. This is an accepted limitation, not a claim that the meta policy prevents framing. Reassess if the audience or exposure materially changes. Public registration was disabled and leaked-password protection enabled and verified on 3 October 2026. Existing-user sign-in is retained; no paid plan change or credential rotation was made.
