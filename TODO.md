# Ben's OpsDeck To-Do

## Current Status

- Current visible app version: v2.11.
- Latest on-chocks now works as a standalone gross-check tool after Duty start time, Maximum FDP, and optional Commander's discretion are entered.
- Latest on-chocks includes a live countdown and Commander’s discretion note when discretion is used.
- Midnight rollover has been tested, including latest takeoff and latest on-chocks showing the next Zulu day with `+1`.
- Telegram reminder database tables and Edge Function have been added for fixed 75-minute jumpseat reminders.
- Telegram setup now lives under Settings, with a realistic sample reminder test message.

## Next Priorities

- Telegram setup: complete real-world testing of pairing, sample reminders, and the scheduled 75-minute reminder run.
- Telegram testing: send a test message, then create a controlled jumpseat request around the 75-minute reminder point and confirm only one reminder sends per flight.
- Operational testing: use the app non-operationally alongside the normal BA/manual process, then note anything that slows the user down, is easy to misread, or feels clumsy.
- Backup system: add a daily GitHub Actions backup of Supabase data, ideally into a private or otherwise secure backup location.
- LTOT validation checks: add lightweight automated tests for midnight rollover, Commander’s discretion, missing minutes, latest on-chocks only, and final pushback/takeoff calculations.
- Jumpseat real-use polish: review whether BA ID, queue ordering, search, and daily view are showing exactly what is needed during actual requests.
- Login reliability: keep watching Supabase magic-link rate limits and mobile sign-in behaviour; consider tuning settings or relying more on password sign-in if magic links remain awkward.
- Day export/copy option: consider copying a clean text summary of jumpseat requests for messaging or email.
- Code organisation audit: separate Jumpseat and LTOT logic more clearly before adding more tools.
