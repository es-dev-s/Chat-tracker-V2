import { checkSupabaseResult, withSupabaseFailover } from "./supabase";

async function readMaxTeamSortIndex(): Promise<number> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb
      .from("tracker_teams")
      .select("sort_index")
      .order("sort_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    checkSupabaseResult(res, "max tracker_teams sort_index");
    const raw = res.data?.sort_index;
    return raw != null && Number.isFinite(Number(raw)) ? Number(raw) : -1;
  });
}

async function readMaxProfileSortIndex(): Promise<number> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb
      .from("tracker_profiles")
      .select("sort_index")
      .order("sort_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    checkSupabaseResult(res, "max tracker_profiles sort_index");
    const raw = res.data?.sort_index;
    return raw != null && Number.isFinite(Number(raw)) ? Number(raw) : -1;
  });
}

export async function insertTeamName(name: string): Promise<void> {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("TEAM_NAME_REQUIRED");
  const nextIndex = (await readMaxTeamSortIndex()) + 1;
  await withSupabaseFailover(async (sb) => {
    const res = await sb.from("tracker_teams").insert({ name: trimmed, sort_index: nextIndex });
    checkSupabaseResult(res, "insert tracker_teams");
    return null;
  });
}

export async function insertProfileName(name: string): Promise<void> {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("PROFILE_NAME_REQUIRED");
  const nextIndex = (await readMaxProfileSortIndex()) + 1;
  await withSupabaseFailover(async (sb) => {
    const res = await sb.from("tracker_profiles").insert({ name: trimmed, sort_index: nextIndex });
    checkSupabaseResult(res, "insert tracker_profiles");
    return null;
  });
}

export async function removeTeamCascade(teamName: string): Promise<void> {
  const trimmed = String(teamName || "").trim();
  if (!trimmed) throw new Error("TEAM_NAME_REQUIRED");
  await withSupabaseFailover(async (sb) => {
    const res = await sb.rpc("remove_team_cascade", { p_team_name: trimmed });
    checkSupabaseResult(res, "remove_team_cascade");
    return null;
  });
}

export async function deleteProfileByName(name: string): Promise<void> {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("PROFILE_NAME_REQUIRED");
  await withSupabaseFailover(async (sb) => {
    const res = await sb.from("tracker_profiles").delete().eq("name", trimmed);
    checkSupabaseResult(res, "delete tracker_profiles");
    return null;
  });
}
