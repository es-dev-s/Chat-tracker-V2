/**
 * Merge case-variant team names safely (e.g. "Victoria" + "victoria").
 *
 * Usage:
 *   node scripts/merge-team-case-duplicates.mjs
 *   node scripts/merge-team-case-duplicates.mjs --apply
 *
 * Optional:
 *   TEAM_CANONICAL_MAP_JSON='{"victoria":"Victoria"}' node scripts/merge-team-case-duplicates.mjs --apply
 *
 * Notes:
 * - Default mode is DRY RUN (no writes).
 * - Non-destructive: does NOT delete any rows.
 * - Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env/.env.local.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

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

function lc(value) {
  return String(value ?? "").trim().toLowerCase();
}

function uniqStable(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const k = String(x ?? "");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
  };
}

function parseCanonicalMap() {
  const raw = process.env.TEAM_CANONICAL_MAP_JSON?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      const key = lc(k);
      const val = String(v ?? "").trim();
      if (key && val) out[key] = val;
    }
    return out;
  } catch {
    throw new Error("TEAM_CANONICAL_MAP_JSON is not valid JSON");
  }
}

function chooseCanonical(group, statsByName, forcedCanonical) {
  if (forcedCanonical) return forcedCanonical;
  return [...group]
    .sort((a, b) => {
      const sa = statsByName[a] ?? { usage: 0, sortIndex: Number.POSITIVE_INFINITY };
      const sb = statsByName[b] ?? { usage: 0, sortIndex: Number.POSITIVE_INFINITY };
      if (sb.usage !== sa.usage) return sb.usage - sa.usage;
      if (sa.sortIndex !== sb.sortIndex) return sa.sortIndex - sb.sortIndex;
      return a.localeCompare(b);
    })[0];
}

async function main() {
  loadEnvLocal();
  const { apply } = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const canonicalMap = parseCanonicalMap();
  const sb = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [teamsRes, usersRes, recordsRes] = await Promise.all([
    sb.from("tracker_teams").select("name, sort_index"),
    sb.from("tracker_users").select("user_id, team_name, team_names"),
    sb.from("chat_records").select("id, team"),
  ]);

  for (const res of [teamsRes, usersRes, recordsRes]) {
    if (res.error) {
      console.error("Supabase error:", res.error.message);
      process.exit(1);
    }
  }

  const teams = (teamsRes.data ?? []).map((r) => ({
    name: String(r.name ?? "").trim(),
    sortIndex: Number.isFinite(Number(r.sort_index)) ? Number(r.sort_index) : Number.POSITIVE_INFINITY,
  })).filter((r) => r.name);
  const users = usersRes.data ?? [];
  const records = recordsRes.data ?? [];

  const groups = {};
  for (const t of teams) {
    const keyLc = lc(t.name);
    if (!groups[keyLc]) groups[keyLc] = [];
    groups[keyLc].push(t.name);
  }

  const duplicateGroups = Object.entries(groups)
    .map(([k, names]) => ({ key: k, names: uniqStable(names) }))
    .filter((g) => g.names.length > 1);

  const statsByName = {};
  for (const t of teams) {
    statsByName[t.name] = { usage: 0, sortIndex: t.sortIndex };
  }
  for (const r of records) {
    const team = String(r.team ?? "").trim();
    if (statsByName[team]) statsByName[team].usage += 1;
  }
  for (const u of users) {
    const primary = String(u.team_name ?? "").trim();
    if (statsByName[primary]) statsByName[primary].usage += 1;
    const arr = Array.isArray(u.team_names) ? u.team_names : [];
    for (const t of arr.map(String)) {
      if (statsByName[t]) statsByName[t].usage += 1;
    }
  }

  const canonicalByLc = new Map();
  for (const t of teams) {
    const keyLc = lc(t.name);
    if (!canonicalByLc.has(keyLc)) canonicalByLc.set(keyLc, t.name);
  }
  for (const g of duplicateGroups) {
    const forced = canonicalMap[g.key];
    if (forced && !g.names.includes(forced)) {
      throw new Error(
        `TEAM_CANONICAL_MAP_JSON invalid for "${g.key}". "${forced}" is not one of: ${g.names.join(", ")}`,
      );
    }
    const canonical = chooseCanonical(g.names, statsByName, forced);
    canonicalByLc.set(g.key, canonical);
  }

  const userArrayVariants = new Map();
  for (const u of users) {
    const arr = Array.isArray(u.team_names) ? u.team_names : [];
    for (const t of arr.map(String)) {
      const n = t.trim();
      if (!n) continue;
      const k = lc(n);
      if (!userArrayVariants.has(k)) userArrayVariants.set(k, new Set());
      userArrayVariants.get(k).add(n);
    }
  }
  const userArrayDupCount = [...userArrayVariants.values()].filter((set) => set.size > 1).length;

  console.log(`Found ${duplicateGroups.length} case-duplicate team groups in tracker_teams.`);
  console.log(`Found ${userArrayDupCount} case-duplicate groups in tracker_users.team_names[].`);
  console.log(apply ? "Mode: APPLY (writes enabled)" : "Mode: DRY RUN (no writes)");

  for (const g of duplicateGroups) {
    const canonical = canonicalByLc.get(g.key);
    if (!canonical) continue;
    const aliases = g.names.filter((n) => n !== canonical);

    console.log(`\nGroup "${g.key}": ${g.names.join(", ")}`);
    console.log(`  Canonical: ${canonical}`);
    console.log(`  Aliases: ${aliases.join(", ")}`);

    if (!apply) continue;

    for (const alias of aliases) {
      const updRecords = await sb.from("chat_records").update({ team: canonical }).eq("team", alias);
      if (updRecords.error) throw new Error(`chat_records ${alias} -> ${canonical}: ${updRecords.error.message}`);

      const updPrimary = await sb.from("tracker_users").update({ team_name: canonical }).eq("team_name", alias);
      if (updPrimary.error) {
        throw new Error(`tracker_users.team_name ${alias} -> ${canonical}: ${updPrimary.error.message}`);
      }
    }
  }

  const userRows = await sb.from("tracker_users").select("user_id, team_name, team_names");
  if (userRows.error) throw new Error(`read tracker_users team fields: ${userRows.error.message}`);

  for (const u of userRows.data ?? []) {
    const currentPrimary = String(u.team_name ?? "").trim();
    const primaryCanonical = canonicalByLc.get(lc(currentPrimary)) ?? currentPrimary;

    const teamNames = Array.isArray(u.team_names) ? u.team_names.map(String) : [];
    const remapped = teamNames
      .map((t) => {
        const trimmed = String(t ?? "").trim();
        return canonicalByLc.get(lc(trimmed)) ?? trimmed;
      })
      .filter(Boolean);
    const next = uniqStable(remapped);

    const samePrimary = primaryCanonical === currentPrimary;
    const sameArray = next.length === teamNames.length && next.every((x, i) => x === teamNames[i]);
    if (samePrimary && sameArray) continue;
    if (!apply) continue;

    const upd = await sb
      .from("tracker_users")
      .update({ team_name: primaryCanonical, team_names: next })
      .eq("user_id", String(u.user_id));
    if (upd.error) throw new Error(`tracker_users normalize user ${u.user_id}: ${upd.error.message}`);
  }

  if (apply) {
    console.log("\nMerge complete. References are case-normalized without deleting rows.");
  } else {
    console.log("\nDry run complete. Re-run with --apply to normalize references.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
