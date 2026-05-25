import { normEmail, readUsers, type AppUser } from "./users";
import { checkSupabaseResult, withSupabaseFailover } from "./supabase";

function appUserToDbRow(u: AppUser) {
  const teamNames = Array.isArray(u.teamNames) ? u.teamNames : [];
  const profileNames = Array.isArray(u.profileNames) ? u.profileNames : [];
  return {
    user_id: String(u.id),
    name: u.name ?? "",
    role: u.role ?? "",
    email: normEmail(u.email),
    password: String(u.password ?? ""),
    team_name: u.teamName ?? "",
    team_names: teamNames,
    profile_names: profileNames,
    is_admin: u.isAdmin === true,
  };
}

export async function upsertTrackerUser(u: AppUser): Promise<void> {
  await withSupabaseFailover(async (sb) => {
    const row = appUserToDbRow(u);
    const res = await sb.from("tracker_users").upsert(row, { onConflict: "user_id" });
    checkSupabaseResult(res, "upsert tracker_users");
    return null;
  });
}

export async function readNextTrackerUserId(): Promise<string> {
  const users = await readUsers();
  let max = 0;
  let anyNumeric = false;
  for (const u of users) {
    const n = Number(u.id);
    if (Number.isFinite(n)) {
      anyNumeric = true;
      max = Math.max(max, Math.trunc(n));
    }
  }
  if (anyNumeric) return String(max + 1);
  const { randomUUID } = await import("node:crypto");
  return randomUUID();
}

export async function deleteUserById(userId: string | number): Promise<void> {
  await withSupabaseFailover(async (sb) => {
    const res = await sb.rpc("delete_tracker_user", { p_user_id: String(userId) });
    checkSupabaseResult(res, "delete_tracker_user");
    return null;
  });
}
