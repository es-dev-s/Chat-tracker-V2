/**
 * Validates Log New Chat Record: form → record payload → DB row round-trip.
 * Run: node scripts/verify-log-chat-save.mjs
 * Live: VERIFY_BASE_URL=http://localhost:5666 node scripts/verify-log-chat-save.mjs
 *       (loads .env.local for Supabase if present)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

function parseTime(t = "") {
  const p = String(t ?? "")
    .trim()
    .split(":")
    .map(Number);
  if (p.length < 2 || p.some((n) => !Number.isFinite(n))) return null;
  const [h, m, s = 0] = p;
  if (h < 0 || m < 0 || m >= 60 || s < 0 || s >= 60) return null;
  return h * 60 + m + s / 60;
}

function diffMins(t1, t2) {
  const a = parseTime(t1);
  const b = parseTime(t2);
  return a != null && b != null ? b - a : null;
}

function resolveEventDate(eventDate, recordDate) {
  const explicit = String(eventDate ?? "").trim();
  if (explicit) return explicit;
  return String(recordDate ?? "").trim();
}

function parseEventEpochMinutes(dateIso, timeStr) {
  const date = resolveEventDate(dateIso, "");
  const mins = parseTime(timeStr);
  if (!date || mins == null) return null;
  const parts = date.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  const wholeH = Math.floor(mins / 60);
  const remM = mins % 60;
  dt.setHours(wholeH, remM, 0);
  return dt.getTime() / 60_000;
}

function diffEventMins(d1, t1, d2, t2, recordDate) {
  const a = parseEventEpochMinutes(resolveEventDate(d1, recordDate), t1);
  const b = parseEventEpochMinutes(resolveEventDate(d2, recordDate), t2);
  if (a == null || b == null) return null;
  return b - a;
}

function persistEventDate(eventDate, recordDate) {
  const resolved = resolveEventDate(eventDate, recordDate);
  const base = String(recordDate ?? "").trim();
  if (!resolved || resolved === base) return null;
  return resolved;
}

function buildChatRecordFromForm(form, user, useFirstReplyAsLast) {
  const nowIso = new Date().toISOString();
  const analystLastReply =
    !form.clientLastReply && useFirstReplyAsLast ? form.firstReply : form.analystLastReply;
  const analystLastDate =
    !form.clientLastReply && useFirstReplyAsLast
      ? form.firstReplyDate
      : form.analystLastReplyDate;
  const recordDate = resolveEventDate(form.firstReceiveDate, form.date) || form.date;
  const noteTrim = (form.note || "").trim();
  return {
    date: recordDate,
    analyst: form.analyst,
    team: form.team,
    profile: String(form.profile || "").trim(),
    clientName: String(form.clientName || "").trim(),
    phone: form.phone,
    note: form.note,
    firstReceive: form.firstReceive,
    firstReply: form.firstReply,
    clientLastReply: form.clientLastReply,
    analystLastReply,
    firstReceiveDate: persistEventDate(form.firstReceiveDate, recordDate) ?? "",
    firstReplyDate: persistEventDate(form.firstReplyDate, recordDate) ?? "",
    clientLastReplyDate: persistEventDate(form.clientLastReplyDate, recordDate) ?? "",
    analystLastReplyDate: persistEventDate(analystLastDate, recordDate) ?? "",
    received: form.received,
    attempted: form.attempted,
    resolved: form.resolved,
    replyDiff: diffEventMins(
      form.firstReceiveDate,
      form.firstReceive,
      form.firstReplyDate,
      form.firstReply,
      recordDate,
    ),
    totalConv: diffEventMins(
      form.firstReceiveDate,
      form.firstReceive,
      analystLastDate,
      analystLastReply,
      recordDate,
    ),
    noteUpdatedAt: noteTrim ? nowIso : null,
    noteUpdatedBy: noteTrim ? user.email : null,
    leadNote: "",
    leadNoteUpdatedAt: null,
    leadNoteUpdatedBy: null,
    isLeadNoteOnly: false,
    createdBy: (user.name && String(user.name).trim()) || user.email,
  };
}

function withValidatedRecordOutcomes(record) {
  const parse = (v, fallback) => {
    if (v === undefined || v === null || v === "") return fallback;
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n) || (n !== 0 && n !== 1)) return null;
    return n;
  };
  const received = parse(record.received, 1);
  const attempted = parse(record.attempted, 1);
  const resolved = parse(record.resolved, 1);
  if (received == null || attempted == null || resolved == null) {
    throw new Error("OUTCOME_FIELDS_INVALID");
  }
  if (attempted > received || resolved > attempted) {
    throw new Error("OUTCOME_ORDER_INVALID");
  }
  return { ...record, received, attempted, resolved };
}

function appRecordToDbRowForInsert(rec) {
  return {
    date: rec.date ?? "",
    analyst: rec.analyst ?? "",
    team: rec.team ?? "",
    profile: rec.profile ?? "",
    client_name: rec.clientName ?? "",
    phone: rec.phone ?? "",
    note: rec.note ?? "",
    first_receive: rec.firstReceive ?? "",
    first_reply: rec.firstReply ?? "",
    client_last_reply: rec.clientLastReply ?? "",
    analyst_last_reply: rec.analystLastReply ?? "",
    first_receive_date: rec.firstReceiveDate || null,
    first_reply_date: rec.firstReplyDate || null,
    client_last_reply_date: rec.clientLastReplyDate || null,
    analyst_last_reply_date: rec.analystLastReplyDate || null,
    received: Number(rec.received ?? 1),
    attempted: Number(rec.attempted ?? 1),
    resolved: Number(rec.resolved ?? 1),
    reply_diff: rec.replyDiff != null ? Number(rec.replyDiff) : null,
    total_conv: rec.totalConv != null ? Number(rec.totalConv) : null,
    note_updated_at: rec.noteUpdatedAt || null,
    note_updated_by: rec.noteUpdatedBy || null,
    lead_note: rec.leadNote ?? "",
    is_lead_note_only: Boolean(rec.isLeadNoteOnly),
    created_by: (rec.createdBy && String(rec.createdBy).trim()) || null,
  };
}

function dbRowToApp(row) {
  return {
    id: Number(row.id),
    date: String(row.date ?? ""),
    analyst: String(row.analyst ?? ""),
    team: String(row.team ?? ""),
    profile: String(row.profile ?? ""),
    clientName: String(row.client_name ?? ""),
    phone: String(row.phone ?? ""),
    note: String(row.note ?? ""),
    firstReceive: String(row.first_receive ?? ""),
    firstReply: String(row.first_reply ?? ""),
    clientLastReply: String(row.client_last_reply ?? ""),
    analystLastReply: String(row.analyst_last_reply ?? ""),
    firstReceiveDate: String(row.first_receive_date ?? ""),
    firstReplyDate: String(row.first_reply_date ?? ""),
    clientLastReplyDate: String(row.client_last_reply_date ?? ""),
    analystLastReplyDate: String(row.analyst_last_reply_date ?? ""),
    received: Number(row.received ?? 1),
    attempted: Number(row.attempted ?? 1),
    resolved: Number(row.resolved ?? 1),
    replyDiff: row.reply_diff != null ? Number(row.reply_diff) : null,
    totalConv: row.total_conv != null ? Number(row.total_conv) : null,
    createdBy: String(row.created_by ?? ""),
  };
}

const mockUser = {
  name: "Test Analyst",
  email: "test-analyst@example.com",
};

const scenarios = [
  {
    name: "full chat — all fields",
    form: {
      date: "2026-05-25",
      analyst: "Test Analyst",
      team: "Team Alpha",
      profile: "Profile One",
      clientName: "Jane Client",
      phone: "+15551234567",
      note: "Important lead note",
      firstReceive: "09:15:00",
      firstReply: "09:22:00",
      clientLastReply: "09:45:00",
      analystLastReply: "09:50:00",
      received: 1,
      attempted: 1,
      resolved: 1,
    },
    useFirstReplyAsLast: false,
    expect: {
      firstReceive: "09:15:00",
      firstReply: "09:22:00",
      clientLastReply: "09:45:00",
      analystLastReply: "09:50:00",
      profile: "Profile One",
      clientName: "Jane Client",
      phone: "+15551234567",
      note: "Important lead note",
      replyDiff: 7,
      totalConv: 35,
    },
  },
  {
    name: "awaiting reply — only 1st receive",
    form: {
      date: "2026-05-25",
      analyst: "Test Analyst",
      team: "Team Alpha",
      profile: "Profile One",
      clientName: "",
      phone: "",
      note: "",
      firstReceive: "14:30:00",
      firstReply: "",
      clientLastReply: "",
      analystLastReply: "",
      received: 1,
      attempted: 0,
      resolved: 0,
    },
    useFirstReplyAsLast: false,
    expect: {
      firstReceive: "14:30:00",
      firstReply: "",
      analystLastReply: "",
      replyDiff: null,
      totalConv: null,
    },
  },
  {
    name: "use 1st reply as analyst last",
    form: {
      date: "2026-05-25",
      analyst: "Test Analyst",
      team: "Team Alpha",
      profile: "",
      clientName: "Bob",
      phone: "555",
      note: "",
      firstReceive: "10:00:00",
      firstReply: "10:05:00",
      clientLastReply: "",
      analystLastReply: "",
      received: 1,
      attempted: 1,
      resolved: 0,
    },
    useFirstReplyAsLast: true,
    expect: {
      analystLastReply: "10:05:00",
      replyDiff: 5,
      totalConv: 5,
    },
  },
  {
    name: "outcomes 0/0/0",
    form: {
      date: "2026-05-25",
      analyst: "Test Analyst",
      team: "Team Alpha",
      profile: "",
      clientName: "",
      phone: "",
      note: "",
      firstReceive: "08:00:00",
      firstReply: "",
      clientLastReply: "",
      analystLastReply: "",
      received: 0,
      attempted: 0,
      resolved: 0,
    },
    useFirstReplyAsLast: false,
    expect: { received: 0, attempted: 0, resolved: 0 },
  },
  {
    name: "cross-day — client today, analyst tomorrow",
    form: {
      date: "2026-06-04",
      analyst: "Test Analyst",
      team: "Team Alpha",
      profile: "",
      clientName: "",
      phone: "",
      note: "",
      firstReceive: "18:00:00",
      firstReply: "18:05:00",
      clientLastReply: "20:00:00",
      analystLastReply: "09:00:00",
      firstReceiveDate: "2026-06-04",
      firstReplyDate: "2026-06-04",
      clientLastReplyDate: "2026-06-04",
      analystLastReplyDate: "2026-06-05",
      received: 1,
      attempted: 1,
      resolved: 1,
    },
    useFirstReplyAsLast: false,
    expect: {
      replyDiff: 5,
      totalConv: 15 * 60 + 0,
      firstReplyDate: "",
      analystLastReplyDate: "2026-06-05",
    },
  },
];

let passed = 0;
let failed = 0;

function assertEq(label, actual, expected) {
  const a = actual === undefined ? null : actual;
  const e = expected === undefined ? null : expected;
  if (a !== e) {
    console.log(`  FAIL ${label}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`);
    return false;
  }
  return true;
}

function runUnitTests() {
  console.log("\n=== Unit: form → record → DB row round-trip ===\n");

  for (const sc of scenarios) {
    console.log(`Scenario: ${sc.name}`);
    const record = buildChatRecordFromForm(sc.form, mockUser, sc.useFirstReplyAsLast);
    let ok = true;

    for (const [key, val] of Object.entries(sc.expect)) {
      if (!assertEq(key, record[key], val)) ok = false;
    }

    try {
      withValidatedRecordOutcomes(record);
    } catch (e) {
      console.log(`  FAIL server outcomes: ${e.message}`);
      ok = false;
    }

    const dbRow = appRecordToDbRowForInsert(record);
    const readBack = dbRowToApp({ id: 999, ...dbRow });

    for (const key of Object.keys(sc.expect)) {
      if (!assertEq(`readBack.${key}`, readBack[key], record[key])) ok = false;
    }

    if (ok) {
      console.log("  PASS");
      passed++;
    } else {
      failed++;
    }
  }
}

async function runLiveApiTest() {
  const base = process.env.VERIFY_BASE_URL;
  if (!base) {
    console.log("\n=== Live API: skipped (set VERIFY_BASE_URL) ===");
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("\n=== Live API: skipped (SUPABASE env missing) ===");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: users } = await sb
    .from("tracker_users")
    .select("user_id, email, password, role, name, team_name")
    .eq("role", "analyst")
    .limit(1);

  const analyst = users?.[0];
  if (!analyst?.email || !analyst?.password) {
    console.log("\n=== Live API: skipped (no analyst in DB) ===");
    return;
  }

  console.log(`\n=== Live API: POST record as ${analyst.email} ===\n`);

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: analyst.email, password: analyst.password }),
  });
  if (!loginRes.ok) {
    console.log("FAIL login", loginRes.status);
    failed++;
    return;
  }
  const loginBody = await loginRes.json();
  const cookieMatch = /ct_session=([^;]+)/.exec(loginRes.headers.get("set-cookie") || "");
  const cookie = cookieMatch ? `ct_session=${cookieMatch[1]}` : "";

  const stamp = Date.now();
  const form = {
    date: "2026-05-25",
    analyst: analyst.name || analyst.email,
    team: analyst.team_name || "Default",
    profile: "",
    clientName: `Verify Client ${stamp}`,
    phone: `+1${stamp}`,
    note: `verify note ${stamp}`,
    firstReceive: "11:00:00",
    firstReply: "11:07:00",
    clientLastReply: "",
    analystLastReply: "",
    received: 1,
    attempted: 1,
    resolved: 0,
  };

  const payload = buildChatRecordFromForm(
    form,
    { name: analyst.name, email: analyst.email },
    false,
  );

  const postRes = await fetch(`${base}/api/records`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Authorization: `Bearer ${loginBody.token}`,
    },
    body: JSON.stringify({ record: payload }),
  });

  if (!postRes.ok) {
    console.log("FAIL POST", postRes.status, await postRes.text());
    failed++;
    return;
  }

  const { record: saved } = await postRes.json();
  const checks = [
    ["clientName", form.clientName],
    ["phone", form.phone],
    ["note", form.note],
    ["firstReceive", form.firstReceive],
    ["firstReply", form.firstReply],
    ["received", form.received],
    ["attempted", form.attempted],
    ["resolved", form.resolved],
    ["replyDiff", 7],
  ];

  let ok = true;
  for (const [k, v] of checks) {
    if (!assertEq(k, saved[k], v)) ok = false;
  }

  if (ok) {
    console.log("  PASS live save matches form");
    passed++;
    await sb.from("chat_records").delete().eq("id", saved.id);
    console.log(`  (cleaned up record id ${saved.id})`);
  } else {
    failed++;
  }
}

runUnitTests();
await runLiveApiTest();
console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
