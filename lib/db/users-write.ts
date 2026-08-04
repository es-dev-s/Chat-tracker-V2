import { canonicalizeNameList, resolveCatalogName } from "./catalog-names";
import { readProfiles, readTeams } from "./catalogs";
import { normEmail, readUsers, type AppUser } from "./users";
import { checkSupabaseResult, withSupabaseFailover } from "./supabase";

function appUserToDbRow(
  u: AppUser,
  teamsCatalog: readonly string[],
  profilesCatalog: readonly string[],
) {
  const teamNames = canonicalizeNameList(
    Array.isArray(u.teamNames) && u.teamNames.length
      ? u.teamNames
      : u.teamName
        ? [u.teamName]
        : [],
    teamsCatalog,
  );
  const profileNames = canonicalizeNameList(
    Array.isArray(u.profileNames) ? u.profileNames : [],
    profilesCatalog,
  );
  const primary =
    resolveCatalogName(u.teamName, teamsCatalog) ?? teamNames[0] ?? "";
  return {
    user_id: String(u.id),
    name: String(u.name ?? "").trim(),
    role: u.role ?? "",
    email: normEmail(u.email),
    password: String(u.password ?? ""),
    team_name: primary,
    team_names: teamNames,
    profile_names: profileNames,
    is_admin: u.isAdmin === true,
  };
}

export async function upsertTrackerUser(u: AppUser): Promise<void> {
  const [teamsCatalog, profilesCatalog] = await Promise.all([
    readTeams(),
    readProfiles(),
  ]);
  await withSupabaseFailover(async (sb) => {
    const row = appUserToDbRow(u, teamsCatalog, profilesCatalog);
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
