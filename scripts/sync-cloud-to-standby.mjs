/**
 * One-time / periodic copy: cloud (primary) → self-hosted standby.
 *
 * Prerequisites:
 * 1. Migrations applied on BOTH databases (ChatTracker/supabase/migrations/)
 * 2. Local Supabase healthy (REST not returning 500)
 * 3. .env.local has SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (source)
 *    and SUPABASE_URL_SECONDARY + SUPABASE_SERVICE_ROLE_KEY_SECONDARY (target)
 *
 * Run: node scripts/sync-cloud-to-standby.mjs
 * Dry run: node scripts/sync-cloud-to-standby.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const BATCH = 400;

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

const dryRun = process.argv.includes("--dry-run");

const sourceUrl = process.env.SUPABASE_URL?.trim();
const sourceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const targetUrl = process.env.SUPABASE_URL_SECONDARY?.trim();
const targetKey = process.env.SUPABASE_SERVICE_ROLE_KEY_SECONDARY?.trim();

if (!sourceUrl || !sourceKey || !targetUrl || !targetKey) {
  console.error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL_SECONDARY, SUPABASE_SERVICE_ROLE_KEY_SECONDARY in .env.local",
  );
  process.exit(1);
}

function client(url, key) {
  return createClient(url.replace(/\/+$/, ""), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function probe(sb, label, url) {
  const res = await sb.from("chat_records").select("id", { count: "exact", head: true });
  if (res.error) {
    let detail = res.error.message || `HTTP ${res.status}`;
    try {
      const raw = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/`, {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY_SECONDARY ?? "",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY_SECONDARY ?? ""}`,
        },
      });
      const body = await raw.text();
      if (body.includes("dns/balancer resolve")) {
        detail =
          "Kong cannot reach the PostgREST (rest) container — local Supabase stack is broken or partially stopped. On the server run: docker compose ps && docker compose restart";
      } else if (body.length < 400) {
        detail = body;
      }
    } catch {
      //
    }
    throw new Error(`${label} unreachable: ${detail}`);
  }
  return res.count ?? 0;
}

async function fetchAll(sb, table, orderCol = "id") {
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + BATCH - 1;
    const res = await sb.from(table).select("*").order(orderCol, { ascending: true }).range(from, to);
    if (res.error) throw new Error(`read ${table}: ${res.error.message}`);
    const chunk = res.data ?? [];
    rows.push(...chunk);
    if (chunk.length < BATCH) break;
    from += BATCH;
  }
  return rows;
}

async function upsertBatches(sb, table, rows, onConflict) {
  if (!rows.length) {
    console.log(`  ${table}: 0 rows (skip)`);
    return;
  }
  if (dryRun) {
    console.log(`  ${table}: would upsert ${rows.length} rows`);
    return;
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const res = await sb.from(table).upsert(slice, { onConflict });
    if (res.error) throw new Error(`upsert ${table} batch ${i}: ${res.error.message}`);
  }
  console.log(`  ${table}: upserted ${rows.length} rows`);
}

async function resetChatRecordsSequence(sb) {
  if (dryRun) return;
  const res = await sb.rpc("reset_chat_records_id_sequence");
  if (res.error && !String(res.error.message).includes("does not exist")) {
    console.warn(`  sequence reset skipped: ${res.error.message}`);
  }
}

async function main() {
  const source = client(sourceUrl, sourceKey);
  const target = client(targetUrl, targetKey);

  console.log("=== Cloud → standby sync ===");
  console.log(`Source: ${sourceUrl}`);
  console.log(`Target: ${targetUrl}`);
  if (dryRun) console.log("Mode: DRY RUN (no writes)\n");

  const sourceCount = await probe(source, "Source (cloud)", sourceUrl);
  console.log(`Source chat_records: ${sourceCount}`);

  try {
    const targetBefore = await probe(target, "Target (standby)", targetUrl);
    console.log(`Target chat_records (before): ${targetBefore}`);
  } catch (e) {
    console.error("\nTarget database is not ready.");
    console.error(e instanceof Error ? e.message : e);
    console.error("\nFix local Supabase, apply migrations, then re-run this script.");
    process.exit(1);
  }

  console.log("\nReading from cloud…");
  const [records, users, teams, profiles, dismissed] = await Promise.all([
    fetchAll(source, "chat_records", "id"),
    fetchAll(source, "tracker_users", "user_id"),
    fetchAll(source, "tracker_teams", "name"),
    fetchAll(source, "tracker_profiles", "name").catch(() => []),
    fetchAll(source, "dismissed_notifs", "user_key"),
  ]);

  console.log(
    `Fetched: ${records.length} records, ${users.length} users, ${teams.length} teams, ${profiles.length} profiles, ${dismissed.length} dismissed_notifs`,
  );

  console.log("\nWriting to standby…");
  await upsertBatches(target, "chat_records", records, "id");
  await upsertBatches(target, "tracker_users", users, "user_id");
  await upsertBatches(target, "tracker_teams", teams, "name");
  if (profiles.length) await upsertBatches(target, "tracker_profiles", profiles, "name");
  await upsertBatches(target, "dismissed_notifs", dismissed, "user_key");
  await resetChatRecordsSequence(target);

  if (!dryRun) {
    const targetAfter = await probe(target, "Target", targetUrl);
    console.log(`\nTarget chat_records (after): ${targetAfter}`);
    console.log("\nDone. Set SUPABASE_FAILOVER_ENABLED=true when ready.");
  } else {
    console.log("\nDry run complete. Re-run without --dry-run to copy data.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
