import { checkSupabaseResult, withSupabaseFailover } from "./supabase";

export async function readTeams(): Promise<string[]> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb
      .from("tracker_teams")
      .select("name")
      .order("sort_index", { ascending: true });
    checkSupabaseResult(res, "read tracker_teams");
    return (res.data || []).map((row) => String(row.name ?? "")).filter(Boolean);
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
