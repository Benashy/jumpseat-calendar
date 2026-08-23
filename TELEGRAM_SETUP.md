# OpsDeck Telegram Setup

## What Is Already Built

- Supabase tables for private Telegram settings and reminder send history.
- Supabase Edge Function: `opsdeck-telegram`.
- OpsDeck Settings screen for pairing Telegram and sending tests.
- Fixed jumpseat reminder timing: 75 minutes before Zulu departure.
- One scheduled reminder per saved flight/date.
- A `Snooze 15 minutes` button on scheduled jumpseat reminders and their snoozed repeats.
- Duplicate-tap protection so one Telegram message can create only one snooze.
- Telegram messages include flight, route, British-format departure date, request names, BA ID yes/no, available jumpseats, and note text when present.
- Manual LTOT summary sending is prepared in the app and Edge Function source. The live button appears once the updated Edge Function is deployed and reports LTOT summary support.

## Secrets To Add In Supabase

Add these in Supabase Dashboard > Edge Functions > Secrets:

```text
OPSDECK_TELEGRAM_BOT_TOKEN=<token from BotFather>
OPSDECK_CRON_SECRET=<long private random value>
```

Do not add these to GitHub, `app.js`, `supabase-config.js`, localStorage, or any public file.

## BotFather Steps

1. Open Telegram.
2. Search for `@BotFather`.
3. Send `/newbot`.
4. Choose a display name, for example `Ben's OpsDeck`.
5. Choose a username ending in `bot`, for example `BensOpsDeckBot`.
6. Copy the bot token.
7. Paste the token only into Supabase Edge Function secrets.

## Pairing Steps

1. Open OpsDeck and sign in.
2. Open Settings.
3. Create a pairing code.
4. Open the new Telegram bot.
5. Send the pairing code to the bot.
6. Return to OpsDeck and press Check pairing.
7. Press Send test or Send sample reminder.

Pairing messages and snooze button taps are received through Telegram's verified webhook. The webhook secret is generated and retained in Supabase Vault; it is not stored in the browser or repository.

## Cron

Supabase Cron calls the Edge Function every minute once secrets and test pairing are confirmed. This keeps a 15-minute snooze close to its requested time while remaining independent of the iPhone, iPad and MacBook.

Production status checked on 23 July 2026:

- `pg_cron`, `pg_net`, and Supabase Vault are enabled.
- Job `opsdeck-jumpseat-reminders-every-minute` is active.
- Schedule is every minute.
- HTTP timeout is 30 seconds.
- A live BA123 test reminder was recorded as sent at `09:35:02Z`.

The scheduled action is:

```json
{ "action": "run_jumpseat_reminders" }
```

The request must include:

```text
x-opsdeck-cron-secret: <same value as OPSDECK_CRON_SECRET>
```

Use Supabase Vault for the project URL and cron secret when creating the scheduled SQL.
