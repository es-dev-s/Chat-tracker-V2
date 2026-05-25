/**
 * Validates Supabase primary + optional secondary failover configuration.
 * Run: node scripts/verify-db-failover.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

async function probe(label, url, key) {
  const out = { label, url, ok: false, records: null, error: null };
  if (!url || !key) {
    out.error = "missing url or key";
    return out;
  }
  try {
    const sb = createClient(url.replace(/\/+$/, ""), key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const res = await sb.from("chat_records").select("id", { count: "exact", head: true });
    if (res.error) {
      out.error = res.error.message || `HTTP ${res.status}`;
      return out;
    }
    out.ok = true;
    out.records = res.count;
    return out;
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
    return out;
  }
}

const primaryUrl = process.env.SUPABASE_URL?.trim();
const primaryKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const secondaryUrl = process.env.SUPABASE_URL_SECONDARY?.trim();
const secondaryKey = process.env.SUPABASE_SERVICE_ROLE_KEY_SECONDARY?.trim();

console.log("=== Supabase failover env ===");
console.log("SUPABASE_URL:", primaryUrl || "(missing)");
console.log("SUPABASE_URL_SECONDARY:", secondaryUrl || "(not set)");
console.log(
  "Failover:",
  secondaryUrl && secondaryKey ? "enabled (secondary configured)" : "single-node only",
);

const results = [
  await probe("primary", primaryUrl, primaryKey),
  await probe("secondary", secondaryUrl, secondaryKey),
];

console.log("\n=== Probe results ===");
for (const r of results) {
  if (r.error === "missing url or key" && r.label === "secondary") continue;
  console.log(`${r.label}: ${r.ok ? `OK (${r.records ?? 0} records)` : `FAIL — ${r.error}`}`);
}

const primaryOk = results[0]?.ok;
const secondaryOk = results[1]?.ok;
const failed = !primaryOk && !secondaryOk;

if (failed) {
  console.log("\nFAIL — neither database node is reachable.");
  process.exit(1);
}

if (primaryOk && secondaryOk) {
  console.log("\nPASS — both nodes reachable. App will failover automatically on primary errors.");
} else if (primaryOk) {
  console.log("\nPASS — primary reachable. Configure secondary for hot standby.");
} else {
  console.log("\nWARN — primary down but secondary reachable. App can run on standby.");
}

process.exit(0);
