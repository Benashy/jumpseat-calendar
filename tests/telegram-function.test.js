const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const functionSource = fs.readFileSync(path.join(root, "supabase/functions/opsdeck-telegram/index.ts"), "utf8");
const migrationSource = fs.readFileSync(
  path.join(root, "supabase/migrations/20260823082500_add_jumpseat_snooze_webhook.sql"),
  "utf8",
);

test("scheduled jumpseat reminders expose a 15-minute Telegram snooze", () => {
  assert.match(functionSource, /const SNOOZE_MINUTES = 15;/);
  assert.match(functionSource, /text: "Snooze 15 minutes"/);
  assert.match(functionSource, /sendTelegramMessage\(chatId, message, buildSnoozeReplyMarkup\(claim\.id\)\)/);
  assert.match(functionSource, /Snoozed for 15 minutes\./);
});

test("Telegram callback handling is verified and acknowledges button taps", () => {
  assert.match(functionSource, /x-telegram-bot-api-secret-token/);
  assert.match(functionSource, /opsdeck_telegram_webhook_secret_matches/);
  assert.match(functionSource, /answerCallbackQuery/);
  assert.match(functionSource, /editMessageReplyMarkup/);
  assert.doesNotMatch(functionSource, /telegramRequest\("getUpdates"/);
});

test("snooze queue prevents duplicate scheduling from one message", () => {
  assert.match(migrationSource, /unique \(chat_id, source_message_id\)/);
  assert.match(migrationSource, /unique \(callback_query_id\)/);
  assert.match(functionSource, /insertError\?\.code === "23505"/);
  assert.match(functionSource, /This reminder has already been snoozed\./);
});

test("snooze state is private and processed by the one-minute scheduler", () => {
  assert.match(migrationSource, /alter table public\.jumpseat_reminder_snoozes enable row level security/);
  assert.match(migrationSource, /revoke all privileges on table public\.jumpseat_reminder_snoozes from authenticated/);
  assert.match(migrationSource, /'opsdeck-jumpseat-reminders-every-minute'/);
  assert.match(migrationSource, /'\* \* \* \* \*'/);
  assert.match(functionSource, /processDueSnoozes\(now\)/);
});

test("callback payload contains only a compact action and reminder UUID", () => {
  const longestPayload = "odjs:s:".length + 36;
  assert.ok(longestPayload <= 64);
  assert.match(functionSource, /const SNOOZE_CALLBACK_PREFIX = "odjs:s:"/);
  assert.doesNotMatch(functionSource, /callback_data:.*flightNumber/);
  assert.doesNotMatch(functionSource, /callback_data:.*staffName/);
});
