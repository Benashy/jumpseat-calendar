import { createClient } from "npm:@supabase/supabase-js@2";

const FUNCTION_NAME = "opsdeck-telegram";
const REMINDER_OFFSET_MINUTES = 75;
const REMINDER_WINDOW_MINUTES = 10;
const PAIRING_CODE_MINUTES = 15;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-opsdeck-cron-secret",
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

function normaliseText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normaliseFlightNumber(value: unknown) {
  return normaliseText(value).toUpperCase();
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

async function sendTelegramMessage(chatId: string, text: string) {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
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

function telegramChatLabel(chat: Record<string, unknown>) {
  const username = normaliseText(chat.username);
  if (username) return `@${username}`;

  const name = [chat.first_name, chat.last_name].map(normaliseText).filter(Boolean).join(" ");
  return name || `Chat ${chat.id}`;
}

async function resolveChat(userId: string) {
  const admin = requireServerConfig();
  const settings = await getTelegramSettings(userId);
  const pairingCode = normaliseText(settings?.pairing_code).toUpperCase();
  const expiresAt = settings?.pairing_expires_at ? new Date(settings.pairing_expires_at) : null;

  if (!pairingCode || !expiresAt || expiresAt <= new Date()) {
    fail(400, "pairing_code_expired", "Create a fresh pairing code, then send it to the Telegram bot.");
  }

  const updates = await telegramRequest("getUpdates", {
    limit: 100,
    timeout: 0,
    allowed_updates: ["message"],
  });
  const matchingUpdate = [...updates].reverse().find((update: Record<string, unknown>) => {
    const message = update.message as Record<string, unknown> | undefined;
    const chat = message?.chat as Record<string, unknown> | undefined;
    const text = normaliseText(message?.text).toUpperCase();
    return chat?.type === "private" && text.includes(pairingCode);
  }) as Record<string, unknown> | undefined;

  if (!matchingUpdate) {
    fail(404, "pairing_code_not_found", "No recent Telegram message matched that pairing code. Send the code to the bot, then try again.");
  }

  const message = matchingUpdate.message as Record<string, unknown>;
  const chat = message.chat as Record<string, unknown>;
  const chatId = String(chat.id);
  const username = normaliseText(chat.username);
  const label = telegramChatLabel(chat);

  const { error } = await admin
    .from("opsdeck_telegram_settings")
    .upsert({
      user_id: userId,
      chat_id: chatId,
      chat_label: label,
      username: username ? `@${username}` : null,
      enabled: true,
      pairing_code: null,
      pairing_expires_at: null,
      linked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    fail(500, "pairing_save_failed", error.message);
  }

  return {
    ok: true,
    linked: true,
    chat_label: label,
    username: username ? `@${username}` : null,
    reminder_offset_minutes: REMINDER_OFFSET_MINUTES,
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
    notes_policy: "Messages include note text when notes are present.",
  };
}

async function claimReminderRun(userId: string, request: JumpseatRequest, departureAt: Date) {
  const admin = requireServerConfig();
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
  };
  const { data, error } = await admin
    .from("jumpseat_reminder_runs")
    .insert(payload)
    .select("id")
    .single();

  if (error?.code === "23505") {
    return null;
  }

  if (error) {
    throw error;
  }

  return data.id as string;
}

async function finishReminderRun(id: string, status: "sent" | "error", message: string, errorMessage = "") {
  const admin = requireServerConfig();
  await admin
    .from("jumpseat_reminder_runs")
    .update({
      status,
      message: status === "sent" ? message : null,
      error: errorMessage || null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", id);
}

async function runJumpseatReminders() {
  const admin = requireServerConfig();
  const now = new Date();
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
    return { ok: true, checked_at: now.toISOString(), users: 0, due: 0, sent: 0, skipped_duplicates: 0, errors: 0 };
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
      let runId: string | null = null;

      try {
        runId = await claimReminderRun(row.user_id, request, departureAt);
        if (!runId) {
          skippedDuplicates += 1;
          continue;
        }

        await sendTelegramMessage(chatId, message);
        await finishReminderRun(runId, "sent", message);
        sent += 1;
      } catch (error) {
        errors += 1;
        const runMessage = error instanceof Error ? error.message : "Unknown reminder send error";
        if (runId) {
          await finishReminderRun(runId, "error", message, runMessage);
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
    errors,
    reminder_offset_minutes: REMINDER_OFFSET_MINUTES,
    reminder_window_minutes: REMINDER_WINDOW_MINUTES,
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
    const action = String(body.action || "");

    if (action === "run_jumpseat_reminders") {
      requireCron(req, body);
      return jsonResponse(await runJumpseatReminders());
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
