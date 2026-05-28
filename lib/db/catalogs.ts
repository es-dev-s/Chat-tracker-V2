import { checkSupabaseResult, withSupabaseFailover } from "./supabase";

function dedupeCaseInsensitive(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const name = String(raw ?? "").trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export async function readTeams(): Promise<string[]> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb
      .from("tracker_teams")
      .select("name")
      .order("sort_index", { ascending: true });
    checkSupabaseResult(res, "read tracker_teams");
    const names = (res.data || []).map((row) => String(row.name ?? "")).filter(Boolean);
    return dedupeCaseInsensitive(names);
  });
}

export async function readProfiles(): Promise<string[]> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb
      .from("tracker_profiles")
      .select("name")
      .order("sort_index", { ascending: true });
    checkSupabaseResult(res, "read tracker_profiles");
    return (res.data || []).map((row) => String(row.name ?? "")).filter(Boolean);
  });
}
