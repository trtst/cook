import { Pool, type PoolClient } from "pg";

const TRUE_VALUES = new Set(["1", "true", "yes"]);
const TEMPLATE_ID = process.env.WECHAT_MEAL_REMINDER_TEMPLATE_ID?.trim() ?? "";
const CLAIM_LIMIT = 1;
const MAX_RETRIES = 5;
const POLL_INTERVAL_MS = 10_000;
const PROCESSING_LEASE_MINUTES = 15;
const REMINDER_LEAD_MS = 2 * 60 * 60 * 1000;
const REMINDER_SEND_LOCK = "meal-reminder-send";

interface WorkerConfig {
  enabled: boolean;
  env: string;
}

interface OutboxRow {
  id: number;
  aggregate_id: number;
  retry_count: number;
}

interface ReminderTarget {
  id: number;
  user_id: number;
  status: "PENDING" | "SENT" | "FAILED";
  scheduled_at: Date;
  openid: string;
  event_id: number | null;
  event_status: string | null;
  event_time: Date | null;
  event_allowed: boolean | null;
  plan_id: number | null;
  plan_status: string | null;
  plan_date: Date | string | null;
  meal_slot: string | null;
  plan_has_event: boolean | null;
}

interface WechatTokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
  errcode?: unknown;
  errmsg?: unknown;
}

interface WechatSendResponse {
  errcode?: unknown;
  errmsg?: unknown;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function readConfig(): WorkerConfig {
  return {
    enabled: TRUE_VALUES.has((process.env.WORKER_ENABLED ?? "").toLowerCase()),
    env: process.env.NODE_ENV ?? "development"
  };
}

function mealReferenceTime(planDate: Date | string, mealSlot: string) {
  const dateText = typeof planDate === "string" ? planDate.slice(0, 10) : planDate.toISOString().slice(0, 10);
  const times: Record<string, string> = {
    BREAKFAST: "08:00:00",
    LUNCH: "12:00:00",
    AFTERNOON_TEA: "15:30:00",
    DINNER: "18:30:00",
    LATE_NIGHT: "21:30:00"
  };
  const time = times[mealSlot];
  if (!time) throw new Error("unsupported_meal_slot");
  return new Date(`${dateText}T${time}+08:00`);
}

function shanghaiDateTime(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);
  const field = (name: string) => parts.find(part => part.type === name)?.value ?? "";
  return `${field("year")}年${field("month")}月${field("day")}日 ${field("hour")}:${field("minute")}`;
}

function shanghaiDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const field = (name: string) => parts.find(part => part.type === name)?.value ?? "";
  return `${field("year")}年${field("month")}月${field("day")}日`;
}

function mealPlanDateText(value: Date | string) {
  const date = typeof value === "string" ? new Date(`${value.slice(0, 10)}T00:00:00+08:00`) : value;
  return shanghaiDate(date);
}

function shanghaiDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const field = (name: string) => parts.find(part => part.type === name)?.value ?? "";
  return { year: field("year"), month: field("month"), day: field("day") };
}

function mealSlotLabel(slot: string) {
  return slot === "BREAKFAST" ? "早餐" : slot === "LUNCH" ? "午餐" : slot === "AFTERNOON_TEA" ? "下午茶" : slot === "DINNER" ? "晚餐" : "夜宵";
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`wechat_http_${response.status}`);
  return response.json() as Promise<T>;
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new Error("wechat_credentials_missing");
  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", appSecret);
  const payload = await responseJson<WechatTokenResponse>(await fetch(url, { signal: AbortSignal.timeout(5_000) }));
  const token = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
  if (!token || typeof payload.expires_in !== "number" || Number(payload.errcode ?? 0) !== 0) {
    throw new Error(`wechat_token_${String(payload.errcode ?? "invalid_response")}`);
  }
  cachedToken = { value: token, expiresAt: Date.now() + Math.max(0, payload.expires_in - 60) * 1000 };
  return token;
}

async function loadTarget(client: PoolClient, reminderId: number, appId: string): Promise<ReminderTarget | null> {
  const result = await client.query<ReminderTarget>(
    `SELECT r.id, r.user_id, r.status, r.scheduled_at,
            wi.openid,
            e.id AS event_id, e.status AS event_status, e.scheduled_at AS event_time,
            (e.user_id = r.user_id OR EXISTS (
              SELECT 1 FROM dining_event_participants p
              WHERE p.dining_event_id = e.id AND p.user_id = r.user_id AND p.status = 'ACCEPTED'
            )) AS event_allowed,
            p.id AS plan_id, p.status AS plan_status, p.plan_date, p.meal_slot,
            (e_plan.id IS NOT NULL) AS plan_has_event
       FROM meal_reminders r
       JOIN user_wechat_identities wi ON wi.user_id = r.user_id AND wi.appid = $2
       LEFT JOIN dining_events e ON e.id = r.dining_event_id
       LEFT JOIN meal_plan_items p ON p.id = r.meal_plan_item_id
       LEFT JOIN dining_events e_plan ON e_plan.meal_plan_item_id = p.id
      WHERE r.id = $1 AND r.status = 'PENDING'`,
    [reminderId, appId]
  );
  return result.rows[0] ?? null;
}

async function sendReminder(target: ReminderTarget) {
  const token = await getAccessToken();
  const eventReminder = target.event_id !== null;
  const eventTime = eventReminder ? target.event_time : null;
  const planReference = !eventReminder && target.plan_date && target.meal_slot ? mealReferenceTime(target.plan_date, target.meal_slot) : null;
  const expectedAt = eventTime ? new Date(eventTime.getTime() - REMINDER_LEAD_MS) : planReference ? new Date(planReference.getTime() - REMINDER_LEAD_MS) : null;
  if (!expectedAt || expectedAt.getTime() !== new Date(target.scheduled_at).getTime()) throw new Error("reminder_schedule_changed");
  if (eventReminder && (target.event_status === "CANCELLED" || target.event_status === "COMPLETED" || !target.event_allowed)) {
    throw new Error("event_no_longer_active");
  }
  if (!eventReminder && (target.plan_status !== "PLANNED" || target.plan_has_event)) throw new Error("plan_no_longer_active");

  const dateValue = eventTime ? shanghaiDateTime(eventTime) : mealPlanDateText(target.plan_date as Date | string);
  const planDateParts = !eventTime ? shanghaiDateParts(planReference as Date) : null;
  const todayParts = shanghaiDateParts(new Date());
  const planDatePrefix = planDateParts && planDateParts.year === todayParts.year && planDateParts.month === todayParts.month && planDateParts.day === todayParts.day
    ? "今天"
    : planDateParts ? `${Number(planDateParts.month)}月${Number(planDateParts.day)}日` : "今天";
  const remarkValue = eventTime
    ? `${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(eventTime)}开饭，约2小时后开始，可准备。`
    : `${planDatePrefix}有${mealSlotLabel(target.meal_slot as string)}计划，可提前准备。`;
  const body = {
    touser: target.openid,
    template_id: TEMPLATE_ID,
    data: {
      date2: { value: dateValue },
      thing3: { value: remarkValue }
    }
  };
  const result = await responseJson<WechatSendResponse>(await fetch(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5_000)
  }));
  const errcode = Number(result.errcode ?? -1);
  if (errcode !== 0) throw new Error(`wechat_send_${errcode}`);
}

async function claimBatch(pool: Pool): Promise<OutboxRow[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const recovered = await client.query<{ id: number }>(
      `UPDATE outbox_events SET status = 'PENDING', updated_at = NOW()
        WHERE event_type = 'MEAL_REMINDER_SEND' AND status = 'PROCESSING'
          AND updated_at < NOW() - ($1 * INTERVAL '1 minute')`,
      [PROCESSING_LEASE_MINUTES]
    );
    if (recovered.rowCount) {
      console.warn(`[worker] recovered ${recovered.rowCount} stale meal reminder claim(s).`);
    }
    const rows = await client.query<OutboxRow>(
      `SELECT id, aggregate_id, retry_count FROM outbox_events
        WHERE event_type = 'MEAL_REMINDER_SEND' AND status = 'PENDING' AND next_run_at <= NOW()
        ORDER BY next_run_at, id LIMIT $1 FOR UPDATE SKIP LOCKED`,
      [CLAIM_LIMIT]
    );
    if (rows.rows.length) {
      await client.query(
        `UPDATE outbox_events SET status = 'PROCESSING', updated_at = NOW() WHERE id = ANY($1::int[])`,
        [rows.rows.map(row => row.id)]
      );
    }
    await client.query("COMMIT");
    return rows.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function finishOutbox(client: PoolClient, row: OutboxRow, outcome: { sent: boolean; error?: string; deferAt?: Date }) {
  if (outcome.deferAt) {
    await client.query("UPDATE outbox_events SET status = 'PENDING', next_run_at = $2, updated_at = NOW() WHERE id = $1 AND status = 'PROCESSING'", [row.id, outcome.deferAt]);
  } else if (outcome.sent) {
    await client.query("UPDATE meal_reminders SET status = 'SENT', sent_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = $1 AND status = 'PENDING'", [row.aggregate_id]);
    await client.query("UPDATE outbox_events SET status = 'SUCCEEDED', done_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = $1 AND status = 'PROCESSING'", [row.id]);
  } else if (outcome.error === "event_no_longer_active" || outcome.error === "plan_no_longer_active" || outcome.error === "reminder_schedule_changed") {
    await client.query("DELETE FROM meal_reminders WHERE id = $1 AND status = 'PENDING'", [row.aggregate_id]);
    await client.query("UPDATE outbox_events SET status = 'SUCCEEDED', done_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = $1 AND status = 'PROCESSING'", [row.id]);
  } else {
    const retryCount = row.retry_count + 1;
    const safeError = (outcome.error ?? "send_failed").slice(0, 255);
    if (retryCount >= MAX_RETRIES) {
      await client.query("UPDATE meal_reminders SET status = 'FAILED', last_error = $2, updated_at = NOW() WHERE id = $1 AND status = 'PENDING'", [row.aggregate_id, safeError]);
      await client.query("UPDATE outbox_events SET status = 'FAILED', retry_count = $2, last_error = $3, updated_at = NOW() WHERE id = $1 AND status = 'PROCESSING'", [row.id, retryCount, safeError]);
    } else {
      const delaySeconds = Math.min(30 * 2 ** (retryCount - 1), 1800);
      await client.query("UPDATE outbox_events SET status = 'PENDING', retry_count = $2, next_run_at = NOW() + make_interval(secs => $3), last_error = $4, updated_at = NOW() WHERE id = $1 AND status = 'PROCESSING'", [row.id, retryCount, delaySeconds, safeError]);
    }
  }
}

async function processReminder(pool: Pool, row: OutboxRow, appId: string) {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [REMINDER_SEND_LOCK]);
    const outbox = await client.query<{ status: string }>("SELECT status FROM outbox_events WHERE id = $1 FOR UPDATE", [row.id]);
    if (outbox.rows[0]?.status !== "PROCESSING") {
      await client.query("COMMIT");
      transactionOpen = false;
      return;
    }
    const target = await loadTarget(client, row.aggregate_id, appId);
    if (!target) {
      await finishOutbox(client, row, { sent: false, error: "plan_no_longer_active" });
      await client.query("COMMIT");
      transactionOpen = false;
      return;
    }
    if (new Date(target.scheduled_at).getTime() > Date.now()) {
      await finishOutbox(client, row, { sent: false, deferAt: new Date(target.scheduled_at) });
      await client.query("COMMIT");
      transactionOpen = false;
      return;
    }
    try {
      await sendReminder(target);
      await finishOutbox(client, row, { sent: true });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "send_failed";
      await finishOutbox(client, row, { sent: false, error: reason });
      console.warn(`[worker] meal reminder ${row.aggregate_id} send failed: ${reason}`);
    }
    await client.query("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    const reason = error instanceof Error ? error.message : "send_failed";
    console.error(`[worker] meal reminder ${row.aggregate_id} processing failed: ${reason}`);
  } finally {
    client.release();
  }
}

async function runWorker() {
  const config = readConfig();
  if (!config.enabled) {
    console.info(`[worker] disabled in ${config.env}; no async jobs were started.`);
    return;
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  if (!databaseUrl || !appId || !appSecret || !TEMPLATE_ID) {
    throw new Error("Meal reminder worker requires DATABASE_URL, WECHAT_APP_ID, WECHAT_APP_SECRET, and WECHAT_MEAL_REMINDER_TEMPLATE_ID.");
  }
  const pool = new Pool({ connectionString: databaseUrl, max: 4, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000 });
  let stopping = false;
  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });
  console.info("[worker] meal reminder Outbox consumer started.");
  try {
    while (!stopping) {
      const batch = await claimBatch(pool);
      if (batch.length) {
        for (const row of batch) await processReminder(pool, row, appId);
      } else {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
  } finally {
    await pool.end();
  }
}

void runWorker().catch(error => {
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(`[worker] stopped: ${message}`);
  process.exitCode = 1;
});
