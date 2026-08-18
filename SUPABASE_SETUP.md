# Supabase Setup

This app is prepared for Supabase cloud saving, but it will keep working locally until the Supabase project details are added.

## 1. Create The Supabase Project

1. Go to https://supabase.com/dashboard.
2. Create a new project.
3. Use the free plan.
4. Wait for the project to finish provisioning.

## 2. Create The Cloud Table

1. Open the Supabase project.
2. Go to SQL Editor.
3. Open `supabase-schema.sql` from this repository.
4. Copy the whole file into the SQL Editor.
5. Run it.

This creates the app's private user data tables and enables Row Level Security so each signed-in user can only access their own data.

If the app shows `Cloud load failed`, run `supabase-schema.sql` again. It is safe to rerun, and it includes the table API grants needed when Supabase's automatic table exposure is switched off.

## 3. Get The Project Details

1. In Supabase, go to Project Settings.
2. Open API.
3. Copy the Project URL.
4. Copy the public anon key.

## 4. Set The App URL In Supabase

In Supabase, go to Authentication, then URL Configuration.

Set the Site URL to:

```text
https://benashy.github.io/jumpseat-calendar/
```

Add the same URL to Redirect URLs if Supabase asks for one.

## 5. Connect The App

Open `supabase-config.js` and replace:

```js
url: "https://YOUR_PROJECT_REF.supabase.co",
anonKey: "YOUR_SUPABASE_ANON_KEY",
```

with the Project URL and public anon key from Supabase.

The anon key is allowed to be public. Security comes from Supabase Auth and the Row Level Security rules in `supabase-schema.sql`.

After changing `supabase-config.js`, also update the cache version so GitHub Pages does not keep serving the old placeholder config:

1. In `index.html`, change every `cloud-sync-1` reference to a new value, for example `cloud-sync-2`.
2. In `service-worker.js`, change `jumpseat-calendar-v14` to the next version, for example `jumpseat-calendar-v15`.
3. In `service-worker.js`, change every `cloud-sync-1` reference to the same new value used in `index.html`.

## 6. Account Setup

The app supports email and password sign-in, plus email magic-link sign-in.

Recommended for Ben's single-user setup:

1. Create Ben's account in Supabase Auth or temporarily enable signups to create it once.
2. Confirm the email if Supabase asks for confirmation.
3. Sign in.
4. Disable new public signups in Supabase Auth settings once the account is working.

The app no longer shows a public Create account button.

Supabase's default magic-link limits are strict during repeated testing:

- One magic link per user roughly every 60 seconds.
- A project-wide OTP/magic-link limit of 30 per hour by default.

If magic links become frustrating, prefer password sign-in day to day, or review Authentication > Rate Limits in Supabase. Custom SMTP is only worth considering if email delivery or limits become a genuine problem.

## Private NOTOC Code Library

The NOTOC mapping is deliberately not stored in this public repository. Supabase holds one read-only policy row for each authorised user in `opsdeck_notoc_policy`; browser clients may select their own row but cannot create, alter or delete it.

After an authenticated load, OpsDeck keeps a user-specific copy on that device for offline use. It does not load that copy into the app without a saved signed-in session, and removes the mapping from the running page on sign-out.

Future mapping updates must be applied through an authorised Supabase administration route. Never add the source JSON, a service-role key or a database password to the repository or browser code.

## 7. Test

1. Sign in.
2. Add a test flight.
3. Refresh the page.
4. Confirm the test flight is still there.
5. Open the live site on iPhone.
6. Sign in with the same account.
7. Confirm the test flight appears.
