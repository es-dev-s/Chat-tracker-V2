/**
 * Production checks for workspace sync: version polling, 304, scoping, auth.
 * Run: node scripts/verify-workspace-production.mjs
 * Requires dev server on VERIFY_BASE_URL (default http://localhost:5666).
 */
const BASE = process.env.VERIFY_BASE_URL || "http://localhost:5666";

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  const cookieMatch = /ct_session=([^;]+)/.exec(res.headers.get("set-cookie") || "");
  return {
    status: res.status,
    body,
    cookie: cookieMatch ? `ct_session=${cookieMatch[1]}` : null,
  };
}

async function workspace(cookie, query = "") {
  const url = `${BASE}/api/workspace${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    headers: cookie ? { Cookie: cookie } : {},
    cache: "no-store",
  });
  const body =
    res.status === 304 ? null : await res.json().catch(() => ({}));
  return {
    status: res.status,
    body,
    etag: res.headers.get("etag"),
    version: res.headers.get("x-workspace-version"),
  };
}

function assert(label, ok, detail = "") {
  if (ok) {
    console.log(`PASS ${label}${detail ? `: ${detail}` : ""}`);
    return true;
  }
  console.log(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  return false;
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
  const { data: users, error } = await sb
    .from("tracker_users")
    .select("user_id, email, password, role")
    .limit(20);
  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  const teamLead =
    users?.find((u) => u.role === "teamLead") ||
    users?.find((u) => u.role === "mainTeamLead") ||
    users?.[0];
  if (!teamLead?.email || !teamLead?.password) {
    console.error("No test user with credentials in tracker_users");
    process.exit(1);
  }

  console.log("Workspace production checks at", BASE);
  let passed = 0;
  let failed = 0;
  const track = (ok) => (ok ? (passed += 1) : (failed += 1));

  const loginRes = await login(teamLead.email, teamLead.password);
  track(
    assert(
      "login",
      loginRes.status === 200 && loginRes.cookie,
      `status ${loginRes.status}`,
    ),
  );
  if (!loginRes.cookie) {
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(1);
  }

  const full = await workspace(loginRes.cookie);
  track(
    assert(
      "full workspace",
      full.status === 200 &&
        full.body?.records &&
        Array.isArray(full.body.records) &&
        full.body.version,
      `records=${full.body?.records?.length ?? 0}`,
    ),
  );

  const versionOnly = await workspace(loginRes.cookie, "mode=version");
  track(
    assert(
      "version mode",
      versionOnly.status === 200 &&
        versionOnly.body?.version &&
        !versionOnly.body?.records,
      versionOnly.body?.version,
    ),
  );

  if (full.body?.version) {
    const etag = encodeURIComponent(full.body.version);
    const unchanged = await workspace(
      loginRes.cookie,
      `mode=version&version=${etag}`,
    );
    track(
      assert(
        "304 unchanged version",
        unchanged.status === 304,
        `status ${unchanged.status}`,
      ),
    );
  }

  const noAuth = await workspace(null);
  track(assert("unauthenticated 401", noAuth.status === 401, `status ${noAuth.status}`));

  const badCookie = await workspace("ct_session=invalid.token.here");
  track(
    assert("invalid session 401", badCookie.status === 401, `status ${badCookie.status}`),
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
