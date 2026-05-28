import { readTeams } from "./catalogs";
import { checkSupabaseResult, withSupabaseFailover } from "./supabase";
import { readUsers } from "./users";
import { deleteUserById, upsertTrackerUser } from "./users-write";

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
  const existing = await readTeams();
  if (existing.includes(trimmed)) return;
  if (existing.some((t) => t.trim().toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("TEAM_NAME_CONFLICT_CASE");
  }
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

/**
 * Remove one catalog team by exact name (case-sensitive).
 * The legacy `remove_team_cascade` RPC matched case-insensitively and could
 * delete "Victoria" and "victoria" together — this replaces that behavior.
 */
export async function removeTeamCascade(teamName: string): Promise<void> {
  const trimmed = String(teamName || "").trim();
  if (!trimmed) throw new Error("TEAM_NAME_REQUIRED");

  const users = await readUsers();
  const usersToDelete = users.filter((u) => String(u.teamName ?? "").trim() === trimmed);
  const usersToPatch = users.filter((u) => {
    if (String(u.teamName ?? "").trim() === trimmed) return false;
    return (u.teamNames ?? []).some((t) => String(t).trim() === trimmed);
  });

  await withSupabaseFailover(async (sb) => {
    const delRecords = await sb.from("chat_records").delete().eq("team", trimmed);
    checkSupabaseResult(delRecords, "delete chat_records for team");
    return null;
  });

  for (const u of usersToPatch) {
    const nextNames = (u.teamNames ?? []).filter((t) => String(t).trim() !== trimmed);
    await upsertTrackerUser({ ...u, teamNames: nextNames });
  }

  for (const u of usersToDelete) {
    await deleteUserById(u.id);
  }

  await withSupabaseFailover(async (sb) => {
    const delTeam = await sb.from("tracker_teams").delete().eq("name", trimmed);
    checkSupabaseResult(delTeam, "delete tracker_teams");
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
