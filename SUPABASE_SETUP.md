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

This creates one private data row per signed-in user and enables Row Level Security so each signed-in user can only read and write their own jumpseat data.

## 3. Get The Project Details

1. In Supabase, go to Project Settings.
2. Open API.
3. Copy the Project URL.
4. Copy the public anon key.

## 4. Connect The App

Open `supabase-config.js` and replace:

```js
url: "https://YOUR_PROJECT_REF.supabase.co",
anonKey: "YOUR_SUPABASE_ANON_KEY",
```

with the Project URL and public anon key from Supabase.

The anon key is allowed to be public. Security comes from Supabase Auth and the Row Level Security rules in `supabase-schema.sql`.

## 5. Account Setup

The app currently supports email and password sign-in.

Recommended for Ben's single-user setup:

1. Use Create account in the app once.
2. Confirm the email if Supabase asks for confirmation.
3. Sign in.
4. Once confirmed working, disable new public signups in Supabase Auth settings if desired.

## 6. Test

1. Sign in.
2. Add a test flight.
3. Refresh the page.
4. Confirm the test flight is still there.
5. Open the live site on iPhone.
6. Sign in with the same account.
7. Confirm the test flight appears.

