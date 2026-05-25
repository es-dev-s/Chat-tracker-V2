/**
 * Validates Next.js auth against the same Supabase DB as ChatTracker.
 * Run: node scripts/verify-auth-flow.mjs
 */
const BASE = process.env.VERIFY_BASE_URL || "http://localhost:5666";

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, cookie: res.headers.get("set-cookie") };
}

async function me(token, cookieHeader) {
  const res = await fetch(`${BASE}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await sb
    .from("tracker_users")
    .select("user_id, email, password, role")
    .limit(20);
  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  const byRole = {};
  for (const row of data || []) {
    if (!byRole[row.role]) byRole[row.role] = row;
  }

  console.log("Testing login flow at", BASE);
  let passed = 0;
  let failed = 0;

  for (const role of ["analyst", "teamLead", "mainTeamLead"]) {
    const row = byRole[role];
    if (!row?.email || !row?.password) {
      console.log(`SKIP ${role}: no user in DB`);
      continue;
    }
    const loginRes = await login(row.email, row.password);
    if (loginRes.status !== 200 || !loginRes.body?.token || !loginRes.body?.user) {
      console.log(`FAIL ${role}: login returned ${loginRes.status}`, loginRes.body?.error);
      failed++;
      continue;
    }
    if (loginRes.body.user.role !== role) {
      console.log(`FAIL ${role}: role mismatch`, loginRes.body.user.role);
      failed++;
      continue;
    }
    const cookieMatch = /ct_session=([^;]+)/.exec(loginRes.cookie || "");
    const meRes = await me(loginRes.body.token, cookieMatch ? `ct_session=${cookieMatch[1]}` : null);
    if (meRes.status !== 200 || meRes.body?.user?.role !== role) {
      console.log(`FAIL ${role}: /api/auth/me`, meRes.status, meRes.body?.error);
      failed++;
      continue;
    }
    console.log(`PASS ${role}: login + me OK (${row.email})`);
    passed++;
  }

  const bad = await login("not-a-real-user@example.com", "wrong-password");
  if (bad.status === 401 && bad.body?.error === "INVALID_CREDENTIALS") {
    console.log("PASS invalid credentials rejected");
    passed++;
  } else {
    console.log("FAIL invalid credentials", bad.status, bad.body);
    failed++;
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
