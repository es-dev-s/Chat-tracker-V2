import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Test accounts created in the LOCAL database. Never used against cloud. */
export const E2E_TEAM = "E2E Team";
export const E2E_PROFILE = "E2E Profile";
export const USERS = {
  analyst: {
    user_id: "e2e-analyst",
    name: "E2E Analyst",
    role: "analyst",
    email: "e2e-analyst@test.local",
    password: "e2e-pass-123",
    file: "e2e/.auth/analyst.json",
  },
  mainTeamLead: {
    user_id: "e2e-main-lead",
    name: "E2E Main Lead",
    role: "mainTeamLead",
    email: "e2e-main-lead@test.local",
    password: "e2e-pass-123",
    file: "e2e/.auth/main-lead.json",
  },
} as const;

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    const i = t.indexOf("=");
    if (!t || t.startsWith("#") || i < 1) continue;
    const k = t.slice(0, i).trim();
    if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
  }
}

/** Service-role client for the local Supabase. Throws if the URL is not local. */
export function localDb(): SupabaseClient {
  loadEnvLocal();
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error(`E2E refuses to run: SUPABASE_URL is not local (${url || "unset"}).`);
  }
  if (!key) throw new Error("E2E: SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  return createClient(url, key, { auth: { persistSession: false } });
}

const ids = Object.values(USERS).map((u) => u.user_id);

/** Creates the test users / team / profile and clears rows they made in earlier runs. */
export async function seed() {
  const db = localDb();
  const ok = (res: { error: { message: string } | null }, what: string) => {
    if (res.error) throw new Error(`seed ${what}: ${res.error.message}`);
  };
  ok(await db.from("tracker_teams").upsert({ name: E2E_TEAM, sort_index: 999 }, { onConflict: "name" }), "team");
  ok(await db.from("tracker_profiles").upsert({ name: E2E_PROFILE, sort_index: 999 }, { onConflict: "name" }), "profile");
  ok(
    await db.from("tracker_users").upsert(
      Object.values(USERS).map(({ file: _f, ...u }) => ({
        ...u,
        team_name: E2E_TEAM,
        team_names: [E2E_TEAM],
        profile_names: [E2E_PROFILE],
        is_admin: false,
      })),
      { onConflict: "user_id" },
    ),
    "users",
  );
  ok(await db.from("payment_records").delete().in("created_by_user_id", ids), "clear payments");
  ok(await db.from("whatsapp_audits").delete().in("created_by_user_id", ids), "clear audits");
}
