import { createClient } from "npm:@supabase/supabase-js@2";

const FUNCTION_NAME = "opsdeck-telegram";
const REMINDER_OFFSET_MINUTES = 75;
const REMINDER_WINDOW_MINUTES = 30;
const REMINDER_RETRY_MINUTES = 5;
const MAX_REMINDER_ATTEMPTS = 3;
const PAIRING_CODE_MINUTES = 15;
const SNOOZE_MINUTES = 15;
const SNOOZE_CALLBACK_PREFIX = "odjs:s:";
const WEBHOOK_SECRET_RPC = "opsdeck_telegram_webhook_secret";
const WEBHOOK_SECRET_MATCH_RPC = "opsdeck_telegram_webhook_secret_matches";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-opsdeck-cron-secret, x-telegram-bot-api-secret-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type StaffEntry = string | { name?: string; baid?: boolean };

type JumpseatRequest = {
  id?: string;
  date?: string;
  flightNumber?: string;
  departureTime?: string;
  routeFrom?: string;
  routeTo?: string;
  availableSeats?: number | string | null;
  staff?: StaffEntry[];
  notes?: string;
};

type LtotSummary = {
  latest_pushback?: string;
  latest_takeoff?: string;
  latest_on_chocks?: string;
  limiting_crew?: string;
  duty_start?: string;
  maximum_fdp?: string;
  commander_discretion?: string;
  flight_time?: string;
  taxi_out?: string;
  holding?: string;
  taxi_in?: string;
  contingency?: string;
  sector_length?: string;
};

type TelegramChat = {
  id?: number | string;
  type?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramMessage = {
  message_id?: number;
  text?: string;
  chat?: TelegramChat;
};

type TelegramCallbackQuery = {
  id?: string;
  message?: TelegramMessage;
  data?: string;
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function fail(status: number, code: string, message: string): never {
  throw new AppError(status, code, message);
}

function firstConfiguredSecret(jsonName: string, fallbackNames: string[]) {
  const rawJson = Deno.env.get(jsonName);
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.default) return String(parsed.default);
      const first = Object.values(parsed).find(Boolean);
      if (first) return String(first);
    } catch {
      // Fall back to legacy variable names below.
    }
  }

  for (const name of fallbackNames) {
    const value = Deno.env.get(name);
    if (value) return value;
  }

  return "";
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseSecretKey = firstConfiguredSecret("SUPABASE_SECRET_KEYS", [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]);
const telegramBotToken = Deno.env.get("OPSDECK_TELEGRAM_BOT_TOKEN") || "";
const cronSecret = Deno.env.get("OPSDECK_CRON_SECRET") || "";
const telegramFunctionUrl = `${supabaseUrl}/functions/v1/${FUNCTION_NAME}`;

const supabaseAdmin = supabaseUrl && supabaseSecretKey
  ? createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function requireServerConfig() {
  if (!supabaseAdmin) {
    fail(503, "server_not_configured", "OpsDeck Telegram function is missing Supabase server configuration.");
  }
  return supabaseAdmin;
}

async function requireUser(req: Request) {
  const admin = requireServerConfig();
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    fail(401, "not_signed_in", "Sign in before using Telegram reminders.");
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    fail(401, "invalid_session", "Your sign-in session could not be verified.");
  }

  return data.user;
}

function requireCron(req: Request, body: Record<string, unknown>) {
  if (!cronSecret) {
    fail(503, "cron_secret_missing", "OPSDECK_CRON_SECRET has not been set in Supabase Edge Function secrets.");
  }

  const suppliedSecret = req.headers.get("x-opsdeck-cron-secret") || String(body.cron_secret || "");
  if (suppliedSecret !== cronSecret) {
    fail(401, "bad_cron_secret", "Scheduled reminder call was not authorised.");
  }
}

async function requireTelegramWebhook(req: Request) {
  const admin = requireServerConfig();
  const suppliedSecret = req.headers.get("x-telegram-bot-api-secret-token")?.trim() || "";
  if (!suppliedSecret) {
    fail(401, "webhook_secret_missing", "Telegram webhook credential is missing.");
  }

  const { data, error } = await admin.rpc(WEBHOOK_SECRET_MATCH_RPC, {
    provided_secret: suppliedSecret,
  });
  if (error || data !== true) {
    fail(403, "webhook_secret_invalid", "Telegram webhook credential is invalid.");
  }
}

async function getTelegramWebhookSecret() {
  const admin = requireServerConfig();
  const { data, error } = await admin.rpc(WEBHOOK_SECRET_RPC);
  const secret = normaliseText(data);
  if (error || !secret) {
    fail(503, "webhook_secret_unavailable", "Telegram webhook credential is not configured.");
  }
  return secret;
}

function normaliseText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normaliseFlightNumber(value: unknown) {
  return normaliseText(value).toUpperCase();
}

function cleanSummaryText(value: unknown, fallback = "--", maxLength = 80) {
  const text = normaliseText(value);
  if (!text) return fallback;
  if (text.length > maxLength && maxLength > 80) {
    fail(400, "ltot_summary_too_long", "The joint crew summary is too long to send in one Telegram message.");
  }
  return text.slice(0, maxLength);
}

function isIsoDate(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function isZuluTime(value: unknown) {
  return /^\d{2}:\d{2}$/.test(String(value || ""));
}

function staffName(entry: StaffEntry) {
  return typeof entry === "string" ? normaliseText(entry) : normaliseText(entry?.name);
}

function staffHasBaid(entry: StaffEntry) {
  return typeof entry === "object" && Boolean(entry?.baid);
}

function parseDepartureAt(request: JumpseatRequest) {
  if (!isIsoDate(request.date) || !isZuluTime(request.departureTime)) return null;

  const departureAt = new Date(`${request.date}T${request.departureTime}:00Z`);
  if (Number.isNaN(departureAt.getTime())) return null;
  return departureAt;
}

function isRequestDue(request: JumpseatRequest, now: Date) {
  const departureAt = parseDepartureAt(request);
  if (!departureAt) return false;

  const dueAt = new Date(departureAt.getTime() - REMINDER_OFFSET_MINUTES * 60_000);
  const windowStart = new Date(now.getTime() - REMINDER_WINDOW_MINUTES * 60_000);

  return dueAt <= now && dueAt > windowStart;
}

function getFlightKey(request: JumpseatRequest) {
  return `${request.date}|${normaliseFlightNumber(request.flightNumber)}`;
}

function requestStaff(request: JumpseatRequest) {
  return Array.isArray(request.staff)
    ? request.staff.filter((entry) => staffName(entry))
    : [];
}

function formatOptionalRoute(value: unknown) {
  return normaliseText(value).toUpperCase() || "----";
}

function formatBritishDate(value: unknown) {
  if (!isIsoDate(value)) return normaliseText(value) || "date not set";
  const [year, month, day] = String(value).split("-");
  return `${day}-${month}-${year}`;
}

function buildReminderMessage(request: JumpseatRequest) {
  const staff = requestStaff(request);
  const flightNumber = normaliseFlightNumber(request.flightNumber);
  const routeFrom = formatOptionalRoute(request.routeFrom);
  const routeTo = formatOptionalRoute(request.routeTo);
  const notes = normaliseText(request.notes);
  const availableSeats = request.availableSeats === null || request.availableSeats === undefined || request.availableSeats === ""
    ? "not set"
    : String(request.availableSeats);
  const staffLines = staff.map((entry, index) => {
    const baid = staffHasBaid(entry) ? "yes" : "no";
    return `${index + 1}. ${staffName(entry)} (BA ID: ${baid})`;
  });

  return [
    "OpsDeck jumpseat reminder",
    "",
    `${flightNumber} ${routeFrom}-${routeTo}`,
    `Departure: ${request.departureTime}Z on ${formatBritishDate(request.date)}`,
    "",
    `Requests (${staff.length})`,
    ...staffLines,
    "",
    `Available jumpseats: ${availableSeats}`,
    notes ? `Notes: ${notes}` : "Notes: no notes.",
  ].join("\n");
}

function buildSampleReminderMessage() {
  return buildReminderMessage({
    date: "2026-07-23",
    flightNumber: "BA123",
    departureTime: "14:30",
    routeFrom: "LHR",
    routeTo: "JFK",
    availableSeats: 2,
    staff: [
      { name: "Smith", baid: false },
      { name: "Jones", baid: true },
    ],
    notes: "Sample note",
  });
}

function buildLtotSummaryMessage(summary: LtotSummary) {
  const latestPushback = cleanSummaryText(summary.latest_pushback);
  const latestTakeoff = cleanSummaryText(summary.latest_takeoff);
  const latestOnChocks = cleanSummaryText(summary.latest_on_chocks);

  if (latestPushback === "--" || latestTakeoff === "--" || latestOnChocks === "--") {
    fail(400, "ltot_summary_incomplete", "Complete the LTOT calculation before sending it to Telegram.");
  }

  return [
    "OpsDeck LTOT summary",
    "",
    `Latest pushback: ${latestPushback} (soft limit)`,
    `Latest takeoff: ${latestTakeoff} (hard limit)`,
    `Latest on-chocks: ${latestOnChocks} (FDP limit)`,
    `Limiting crew: ${cleanSummaryText(summary.limiting_crew, "--", 640)}`,
    "",
    "FDP",
    `Duty start: ${cleanSummaryText(summary.duty_start, "--", 640)}`,
    `Maximum FDP: ${cleanSummaryText(summary.maximum_fdp, "--", 640)}`,
    `Commander's discretion: ${cleanSummaryText(summary.commander_discretion, "--", 640)}`,
    "",
    "Final sector timing",
    `Flight time: ${cleanSummaryText(summary.flight_time)}`,
    `Taxi out: ${cleanSummaryText(summary.taxi_out)}`,
    `Holding: ${cleanSummaryText(summary.holding)}`,
    `Taxi in: ${cleanSummaryText(summary.taxi_in)}`,
    `Contingency: ${cleanSummaryText(summary.contingency)}`,
    `Anticipated sector length: ${cleanSummaryText(summary.sector_length)}`,
  ].join("\n");
}

async function telegramRequest(method: string, payload: Record<string, unknown>) {
  if (!telegramBotToken) {
    fail(503, "bot_not_configured", "OPSDECK_TELEGRAM_BOT_TOKEN has not been set in Supabase Edge Function secrets.");
  }

  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    fail(502, "telegram_error", data?.description || `Telegram ${method} failed.`);
  }

  return data.result;
}

function buildSnoozeReplyMarkup(reminderRunId: string) {
  return {
    inline_keyboard: [[
      {
        text: "Snooze 15 minutes",
        callback_data: `${SNOOZE_CALLBACK_PREFIX}${reminderRunId}`,
      },
    ]],
  };
}

function parseSnoozeReminderRunId(value: unknown) {
  const data = normaliseText(value);
  if (!data.startsWith(SNOOZE_CALLBACK_PREFIX)) return "";
  const id = data.slice(SNOOZE_CALLBACK_PREFIX.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : "";
}

async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: Record<string, unknown>) {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

function generatePairingCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `OD-${suffix}`;
}

async function getTelegramSettings(userId: string) {
  const admin = requireServerConfig();
  const { data, error } = await admin
    .from("opsdeck_telegram_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    fail(500, "settings_read_failed", error.message);
  }

  return data;
}

async function startPairing(userId: string) {
  const admin = requireServerConfig();
  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_CODE_MINUTES * 60_000).toISOString();

  const { error } = await admin
    .from("opsdeck_telegram_settings")
    .upsert({
      user_id: userId,
      pairing_code: code,
      pairing_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    fail(500, "pairing_start_failed", error.message);
  }

  return {
    ok: true,
    bot_configured: Boolean(telegramBotToken),
    pairing_code: code,
    pairing_expires_at: expiresAt,
    pairing_minutes: PAIRING_CODE_MINUTES,
  };
}

function telegramChatLabel(chat: TelegramChat) {
  const username = normaliseText(chat.username);
  if (username) return `@${username}`;

  const name = [chat.first_name, chat.last_name].map(normaliseText).filter(Boolean).join(" ");
  return name || `Chat ${chat.id}`;
}

async function resolveChat(userId: string) {
  const settings = await getTelegramSettings(userId);

  if (settings?.enabled && settings.chat_id) {
    return {
      ok: true,
      linked: true,
      chat_label: settings.chat_label || null,
      username: settings.username || null,
      reminder_offset_minutes: REMINDER_OFFSET_MINUTES,
    };
  }

  const pairingCode = normaliseText(settings?.pairing_code).toUpperCase();
  const expiresAt = settings?.pairing_expires_at ? new Date(settings.pairing_expires_at) : null;

  if (!pairingCode || !expiresAt || expiresAt <= new Date()) {
    fail(400, "pairing_code_expired", "Create a fresh pairing code, then send it to the Telegram bot.");
  }

  fail(404, "pairing_pending", "The pairing code has not been received by the Telegram bot yet.");
}

function extractPairingCode(value: unknown) {
  return normaliseText(value).toUpperCase().match(/OD-[A-Z0-9]{6}/)?.[0] || "";
}

async function handleTelegramMessageWebhook(message: TelegramMessage) {
  const admin = requireServerConfig();
  const chat = message.chat;
  const code = extractPairingCode(message.text);
  if (!chat?.id || chat.type !== "private" || !code) return;

  const now = new Date().toISOString();
  const { data: settings, error: settingsError } = await admin
    .from("opsdeck_telegram_settings")
    .select("user_id")
    .eq("pairing_code", code)
    .gt("pairing_expires_at", now)
    .limit(1)
    .maybeSingle();

  if (settingsError) {
    fail(500, "pairing_lookup_failed", settingsError.message);
  }

  if (!settings) {
    return;
  }

  const username = normaliseText(chat.username);
  const label = telegramChatLabel(chat);
  const { data: linked, error: updateError } = await admin
    .from("opsdeck_telegram_settings")
    .update({
      chat_id: String(chat.id),
      chat_label: label,
      username: username ? `@${username}` : null,
      enabled: true,
      pairing_code: null,
      pairing_expires_at: null,
      linked_at: now,
      updated_at: now,
    })
    .eq("user_id", settings.user_id)
    .eq("pairing_code", code)
    .select("user_id")
    .maybeSingle();

  if (updateError || !linked) {
    fail(500, "pairing_save_failed", updateError?.message || "Pairing state changed before it could be saved.");
  }

  await sendTelegramMessage(String(chat.id), "Telegram reminders are linked to OpsDeck.");
}

async function answerTelegramCallback(callbackId: string, text: string, showAlert = false) {
  if (!callbackId) return;
  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
    show_alert: showAlert,
  });
}

async function removeSnoozeButton(chatId: string, messageId: number | undefined) {
  if (!chatId || !messageId) return;
  try {
    await telegramRequest("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Snooze button could not be removed.");
  }
}

async function handleTelegramCallbackWebhook(callback: TelegramCallbackQuery) {
  const admin = requireServerConfig();
  const callbackId = normaliseText(callback.id);
  const chatId = callback.message?.chat?.id === undefined ? "" : String(callback.message.chat.id);
  const messageId = callback.message?.message_id;
  const reminderRunId = parseSnoozeReminderRunId(callback.data);

  if (!callbackId || !chatId) return;
  if (!messageId) {
    await answerTelegramCallback(callbackId, "That reminder action is no longer available.", true);
    return;
  }
  if (!reminderRunId) {
    await answerTelegramCallback(callbackId, "That reminder action is no longer available.", true);
    return;
  }

  const { data: settings, error: settingsError } = await admin
    .from("opsdeck_telegram_settings")
    .select("user_id")
    .eq("chat_id", chatId)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();
  if (settingsError) {
    fail(500, "settings_read_failed", settingsError.message);
  }
  if (!settings) {
    await answerTelegramCallback(callbackId, "Telegram is not linked to an OpsDeck account.", true);
    return;
  }

  const { data: run, error: runError } = await admin
    .from("jumpseat_reminder_runs")
    .select("id, user_id, message")
    .eq("id", reminderRunId)
    .eq("user_id", settings.user_id)
    .maybeSingle();
  if (runError) {
    fail(500, "reminder_read_failed", runError.message);
  }
  if (!run?.message) {
    await answerTelegramCallback(callbackId, "That reminder is no longer available.", true);
    return;
  }

  const now = new Date();
  const dueAt = new Date(now.getTime() + SNOOZE_MINUTES * 60_000);

  const { error: insertError } = await admin
    .from("jumpseat_reminder_snoozes")
    .insert({
      user_id: settings.user_id,
      reminder_run_id: run.id,
      chat_id: chatId,
      source_message_id: messageId,
      callback_query_id: callbackId,
      due_at: dueAt.toISOString(),
      next_attempt_at: dueAt.toISOString(),
      status: "pending",
    });

  if (insertError?.code === "23505") {
    await removeSnoozeButton(chatId, messageId);
    await answerTelegramCallback(callbackId, "This reminder has already been snoozed.");
    return;
  }
  if (insertError) {
    fail(500, "snooze_save_failed", insertError.message);
  }

  await removeSnoozeButton(chatId, messageId);
  await answerTelegramCallback(callbackId, "Snoozed for 15 minutes.");
}

async function handleTelegramWebhook(req: Request, update: TelegramUpdate) {
  await requireTelegramWebhook(req);
  if (update.message) await handleTelegramMessageWebhook(update.message);
  if (update.callback_query) await handleTelegramCallbackWebhook(update.callback_query);
  return { ok: true };
}

async function configureTelegramWebhook() {
  const secret = await getTelegramWebhookSecret();
  await telegramRequest("setWebhook", {
    url: telegramFunctionUrl,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  const status = await telegramRequest("getWebhookInfo", {});
  return {
    ok: true,
    configured: true,
    url: status?.url || "",
    allowed_updates: status?.allowed_updates || [],
    pending_update_count: status?.pending_update_count || 0,
    last_error_message: status?.last_error_message || "",
  };
}

async function sendTest(userId: string) {
  const admin = requireServerConfig();
  const settings = await getTelegramSettings(userId);

  if (!settings?.enabled || !settings.chat_id) {
    fail(400, "telegram_not_linked", "Link Telegram before sending a test message.");
  }

  await sendTelegramMessage(settings.chat_id, [
    "OpsDeck Telegram test",
    "",
    "Jumpseat reminders are linked.",
    "Reminder timing: 75 minutes before Zulu departure.",
  ].join("\n"));

  const testSentAt = new Date().toISOString();
  const { error } = await admin
    .from("opsdeck_telegram_settings")
    .update({
      test_sent_at: testSentAt,
      updated_at: testSentAt,
    })
    .eq("user_id", userId);

  if (error) {
    fail(500, "test_update_failed", error.message);
  }

  return {
    ok: true,
    test_sent_at: testSentAt,
  };
}

async function sendSampleReminder(userId: string) {
  const admin = requireServerConfig();
  const settings = await getTelegramSettings(userId);

  if (!settings?.enabled || !settings.chat_id) {
    fail(400, "telegram_not_linked", "Link Telegram before sending a sample reminder.");
  }

  await sendTelegramMessage(settings.chat_id, buildSampleReminderMessage());

  const testSentAt = new Date().toISOString();
  const { error } = await admin
    .from("opsdeck_telegram_settings")
    .update({
      test_sent_at: testSentAt,
      updated_at: testSentAt,
    })
    .eq("user_id", userId);

  if (error) {
    fail(500, "sample_update_failed", error.message);
  }

  return {
    ok: true,
    test_sent_at: testSentAt,
  };
}

async function sendLtotSummary(userId: string, summary: unknown) {
  const admin = requireServerConfig();
  const settings = await getTelegramSettings(userId);

  if (!settings?.enabled || !settings.chat_id) {
    fail(400, "telegram_not_linked", "Link Telegram before sending an LTOT summary.");
  }

  if (!summary || typeof summary !== "object") {
    fail(400, "ltot_summary_missing", "Complete the LTOT calculation before sending it to Telegram.");
  }

  await sendTelegramMessage(settings.chat_id, buildLtotSummaryMessage(summary as LtotSummary));

  const testSentAt = new Date().toISOString();
  const { error } = await admin
    .from("opsdeck_telegram_settings")
    .update({
      test_sent_at: testSentAt,
      updated_at: testSentAt,
    })
    .eq("user_id", userId);

  if (error) {
    fail(500, "ltot_update_failed", error.message);
  }

  return {
    ok: true,
    sent_at: testSentAt,
  };
}

async function probe(userId: string) {
  const settings = await getTelegramSettings(userId);

  return {
    ok: true,
    function: FUNCTION_NAME,
    bot_configured: Boolean(telegramBotToken),
    cron_configured: Boolean(cronSecret),
    linked: Boolean(settings?.enabled && settings?.chat_id),
    chat_label: settings?.chat_label || null,
    username: settings?.username || null,
    test_sent_at: settings?.test_sent_at || null,
    reminder_offset_minutes: REMINDER_OFFSET_MINUTES,
    snooze_minutes: SNOOZE_MINUTES,
    snooze_supported: true,
    notes_policy: "Messages include note text when notes are present.",
    ltot_summary_supported: true,
  };
}

type ReminderClaim = {
  id: string;
  attempt: number;
  isRetry: boolean;
};

async function claimReminderRun(
  userId: string,
  request: JumpseatRequest,
  departureAt: Date,
  message: string,
): Promise<ReminderClaim | null> {
  const admin = requireServerConfig();
  const now = new Date();
  const nextAttemptAt = new Date(now.getTime() + REMINDER_RETRY_MINUTES * 60_000);
  const flightNumber = normaliseFlightNumber(request.flightNumber);
  const reminderDueAt = new Date(departureAt.getTime() - REMINDER_OFFSET_MINUTES * 60_000);
  const payload = {
    user_id: userId,
    flight_key: getFlightKey(request),
    flight_date: request.date,
    flight_number: flightNumber,
    departure_time: request.departureTime,
    reminder_offset_minutes: REMINDER_OFFSET_MINUTES,
    scheduled_departure_at: departureAt.toISOString(),
    reminder_due_at: reminderDueAt.toISOString(),
    status: "pending",
    attempt_count: 1,
    last_attempt_at: now.toISOString(),
    next_attempt_at: nextAttemptAt.toISOString(),
    message,
  };
  const { data, error } = await admin
    .from("jumpseat_reminder_runs")
    .insert(payload)
    .select("id, attempt_count")
    .single();

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await admin
      .from("jumpseat_reminder_runs")
      .select("id, status, attempt_count, next_attempt_at")
      .eq("user_id", userId)
      .eq("flight_key", payload.flight_key)
      .eq("reminder_offset_minutes", REMINDER_OFFSET_MINUTES)
      .single();
    if (existingError) throw existingError;

    const attemptCount = Number(existing.attempt_count || 0);
    const retryAtMs = existing.next_attempt_at ? Date.parse(existing.next_attempt_at) : 0;
    const canRetry = ["pending", "error"].includes(existing.status) &&
      attemptCount < MAX_REMINDER_ATTEMPTS &&
      retryAtMs <= now.getTime();
    if (!canRetry) return null;

    const nextAttempt = attemptCount + 1;
    const { data: claimed, error: claimError } = await admin
      .from("jumpseat_reminder_runs")
      .update({
        status: "pending",
        attempt_count: nextAttempt,
        last_attempt_at: now.toISOString(),
        next_attempt_at: nextAttemptAt.toISOString(),
        message,
        error: null,
      })
      .eq("id", existing.id)
      .eq("attempt_count", attemptCount)
      .in("status", ["pending", "error"])
      .select("id, attempt_count")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return null;

    return { id: claimed.id as string, attempt: Number(claimed.attempt_count), isRetry: true };
  }

  if (error) {
    throw error;
  }

  return { id: data.id as string, attempt: Number(data.attempt_count), isRetry: false };
}

async function finishReminderRun(id: string, status: "sent" | "error", message: string, errorMessage = "") {
  const admin = requireServerConfig();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data, error } = await admin
      .from("jumpseat_reminder_runs")
      .update({
        status,
        message: status === "sent" ? message : null,
        error: errorMessage || null,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        next_attempt_at: status === "sent" ? null : new Date(Date.now() + REMINDER_RETRY_MINUTES * 60_000).toISOString(),
      })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (!error && data) return;

    lastError = new Error(error?.message || "Reminder status update returned no row.");
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 200));
  }

  throw lastError || new Error("Reminder status could not be updated.");
}

type SnoozeSummary = {
  due: number;
  sent: number;
  errors: number;
};

async function finishSnoozeRun(
  id: string,
  status: "sent" | "error",
  errorMessage = "",
) {
  const admin = requireServerConfig();
  const now = new Date();
  const { error } = await admin
    .from("jumpseat_reminder_snoozes")
    .update({
      status,
      error: errorMessage || null,
      sent_at: status === "sent" ? now.toISOString() : null,
      next_attempt_at: status === "error"
        ? new Date(now.getTime() + REMINDER_RETRY_MINUTES * 60_000).toISOString()
        : null,
      updated_at: now.toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

async function processDueSnoozes(now: Date): Promise<SnoozeSummary> {
  const admin = requireServerConfig();
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - REMINDER_RETRY_MINUTES * 60_000).toISOString();

  const { error: recoveryError } = await admin
    .from("jumpseat_reminder_snoozes")
    .update({
      status: "error",
      next_attempt_at: nowIso,
      error: "Recovered an interrupted snooze delivery.",
      updated_at: nowIso,
    })
    .eq("status", "processing")
    .lt("last_attempt_at", staleBefore);
  if (recoveryError) throw recoveryError;

  const { data: candidates, error: queueError } = await admin
    .from("jumpseat_reminder_snoozes")
    .select("id, user_id, reminder_run_id, chat_id, status, attempt_count")
    .in("status", ["pending", "error"])
    .lte("due_at", nowIso)
    .lte("next_attempt_at", nowIso)
    .lt("attempt_count", MAX_REMINDER_ATTEMPTS)
    .order("due_at", { ascending: true })
    .limit(20);
  if (queueError) throw queueError;

  const summary: SnoozeSummary = { due: candidates?.length || 0, sent: 0, errors: 0 };

  for (const candidate of candidates || []) {
    const attemptCount = Number(candidate.attempt_count || 0);
    const nextAttempt = attemptCount + 1;
    const { data: claimed, error: claimError } = await admin
      .from("jumpseat_reminder_snoozes")
      .update({
        status: "processing",
        attempt_count: nextAttempt,
        last_attempt_at: nowIso,
        next_attempt_at: null,
        error: null,
        updated_at: nowIso,
      })
      .eq("id", candidate.id)
      .eq("attempt_count", attemptCount)
      .in("status", ["pending", "error"])
      .select("id")
      .maybeSingle();
    if (claimError) {
      summary.errors += 1;
      continue;
    }
    if (!claimed) continue;

    try {
      const { data: run, error: runError } = await admin
        .from("jumpseat_reminder_runs")
        .select("id, message")
        .eq("id", candidate.reminder_run_id)
        .eq("user_id", candidate.user_id)
        .maybeSingle();
      if (runError) throw runError;
      if (!run?.message) throw new Error("Original jumpseat reminder is unavailable.");

      const { data: settings, error: settingsError } = await admin
        .from("opsdeck_telegram_settings")
        .select("user_id")
        .eq("user_id", candidate.user_id)
        .eq("chat_id", candidate.chat_id)
        .eq("enabled", true)
        .maybeSingle();
      if (settingsError) throw settingsError;
      if (!settings) throw new Error("Telegram is no longer linked for this reminder.");

      await sendTelegramMessage(
        candidate.chat_id,
        run.message,
        buildSnoozeReplyMarkup(run.id),
      );
      await finishSnoozeRun(candidate.id, "sent");
      summary.sent += 1;
    } catch (error) {
      summary.errors += 1;
      const message = error instanceof Error ? error.message : "Unknown snooze delivery error";
      try {
        await finishSnoozeRun(candidate.id, "error", message);
      } catch (statusError) {
        console.error(statusError instanceof Error ? statusError.message : "Snooze error status could not be saved.");
      }
      console.error(message);
    }
  }

  return summary;
}

async function runJumpseatReminders() {
  const admin = requireServerConfig();
  const now = new Date();
  const snoozes = await processDueSnoozes(now);
  const { data: settingsRows, error: settingsError } = await admin
    .from("opsdeck_telegram_settings")
    .select("user_id, chat_id")
    .eq("enabled", true)
    .not("chat_id", "is", null);

  if (settingsError) {
    fail(500, "settings_scan_failed", settingsError.message);
  }

  const settingsByUser = new Map((settingsRows || []).map((row) => [row.user_id, row.chat_id]));
  const userIds = [...settingsByUser.keys()];
  if (userIds.length === 0) {
    return {
      ok: true,
      checked_at: now.toISOString(),
      users: 0,
      due: 0,
      sent: 0,
      skipped_duplicates: 0,
      errors: 0,
      snoozes,
    };
  }

  const { data: requestRows, error: requestError } = await admin
    .from("jumpseat_data")
    .select("user_id, requests")
    .in("user_id", userIds);

  if (requestError) {
    fail(500, "request_scan_failed", requestError.message);
  }

  let due = 0;
  let sent = 0;
  let skippedDuplicates = 0;
  let retried = 0;
  let errors = 0;

  for (const row of requestRows || []) {
    const chatId = settingsByUser.get(row.user_id);
    const requests = Array.isArray(row.requests) ? row.requests as JumpseatRequest[] : [];

    for (const request of requests) {
      const staff = requestStaff(request);
      const departureAt = parseDepartureAt(request);
      if (!chatId || !departureAt || staff.length === 0 || !isRequestDue(request, now)) continue;

      due += 1;
      const message = buildReminderMessage(request);
      let claim: ReminderClaim | null = null;

      try {
        claim = await claimReminderRun(row.user_id, request, departureAt, message);
        if (!claim) {
          skippedDuplicates += 1;
          continue;
        }
        if (claim.isRetry) retried += 1;

        await sendTelegramMessage(chatId, message, buildSnoozeReplyMarkup(claim.id));
        await finishReminderRun(claim.id, "sent", message);
        sent += 1;
      } catch (error) {
        errors += 1;
        const runMessage = error instanceof Error ? error.message : "Unknown reminder send error";
        if (claim) {
          try {
            await finishReminderRun(claim.id, "error", message, runMessage);
          } catch (statusError) {
            console.error(statusError instanceof Error ? statusError.message : "Reminder error status could not be saved.");
          }
        }
        console.error(runMessage);
      }
    }
  }

  return {
    ok: true,
    checked_at: now.toISOString(),
    users: userIds.length,
    due,
    sent,
    skipped_duplicates: skippedDuplicates,
    retried,
    errors,
    reminder_offset_minutes: REMINDER_OFFSET_MINUTES,
    reminder_window_minutes: REMINDER_WINDOW_MINUTES,
    max_reminder_attempts: MAX_REMINDER_ATTEMPTS,
    snooze_minutes: SNOOZE_MINUTES,
    snoozes,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      fail(405, "method_not_allowed", "Use POST for OpsDeck Telegram actions.");
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (body.update_id !== undefined || body.message || body.callback_query) {
      return jsonResponse(await handleTelegramWebhook(req, body as TelegramUpdate));
    }

    const action = String(body.action || "");

    if (action === "run_jumpseat_reminders") {
      requireCron(req, body);
      return jsonResponse(await runJumpseatReminders());
    }

    if (action === "configure_webhook") {
      requireCron(req, body);
      return jsonResponse(await configureTelegramWebhook());
    }

    const user = await requireUser(req);

    if (action === "probe") {
      return jsonResponse(await probe(user.id));
    }

    if (action === "start_pairing") {
      return jsonResponse(await startPairing(user.id));
    }

    if (action === "resolve_chat") {
      return jsonResponse(await resolveChat(user.id));
    }

    if (action === "send_test") {
      return jsonResponse(await sendTest(user.id));
    }

    if (action === "send_sample_reminder") {
      return jsonResponse(await sendSampleReminder(user.id));
    }

    if (action === "send_ltot_summary") {
      return jsonResponse(await sendLtotSummary(user.id, body.summary));
    }

    fail(400, "unknown_action", "Unknown OpsDeck Telegram action.");
  } catch (error) {
    if (error instanceof AppError) {
      return jsonResponse({ ok: false, code: error.code, message: error.message }, error.status);
    }

    const message = error instanceof Error ? error.message : "Unexpected OpsDeck Telegram error.";
    console.error(message);
    return jsonResponse({ ok: false, code: "unexpected_error", message }, 500);
  }
});
