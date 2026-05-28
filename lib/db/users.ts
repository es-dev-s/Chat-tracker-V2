import {
  checkSupabaseResult,
  throwIfRetryableSupabaseError,
  withSupabaseFailover,
} from "./supabase";

export type UserRole = "analyst" | "teamLead" | "mainTeamLead";

export type AppUser = {
  id: number | string;
  name: string;
  role: UserRole | string;
  email: string;
  password?: string;
  teamName: string;
  teamNames: string[];
  profileNames: string[];
  isAdmin: boolean;
};

function normalizeTeamNames(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const v of raw) {
      const t = String(v ?? "").trim();
      const key = t.toLowerCase();
      if (!t || seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const out: string[] = [];
      const seen = new Set<string>();
      for (const v of parsed) {
        const t = String(v ?? "").trim();
        const key = t.toLowerCase();
        if (!t || seen.has(key)) continue;
        seen.add(key);
        out.push(t);
      }
      return out;
    } catch {
      return [];
    }
  }
  return [];
}

export function dbUserRowToApp(row: Record<string, unknown>): AppUser | null {
  if (!row?.user_id) return null;
  const idRaw = String(row.user_id);
  const id = /^-?\d+$/.test(idRaw) ? Number(idRaw) : idRaw;
  const teamNames = normalizeTeamNames(row.team_names);
  const profileNames = normalizeTeamNames(row.profile_names);
  const adminRaw = row.is_admin ?? row.isAdmin;
  return {
    id,
    name: String(row.name ?? ""),
    role: String(row.role ?? ""),
    email: String(row.email ?? ""),
    password: String(row.password ?? ""),
    teamName: String(row.team_name ?? ""),
    teamNames: teamNames.length
      ? teamNames
      : row.team_name
        ? [String(row.team_name)]
        : [],
    profileNames,
    isAdmin:
      adminRaw === true ||
      adminRaw === "t" ||
      adminRaw === "true" ||
      adminRaw === 1,
  };
}

export function stripPassword(user: AppUser): Omit<AppUser, "password"> {
  const { password: _p, ...rest } = user;
  void _p;
  return rest;
}

export function normEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/** Single-row lookup — used on every authenticated page load (fast session restore). */
export async function readUserBySession(
  userId: string | number,
  email: string,
): Promise<AppUser | null> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb
      .from("tracker_users")
      .select("*")
      .eq("user_id", String(userId))
      .maybeSingle();
    throwIfRetryableSupabaseError(res.error, res.status, "readUserBySession");
    if (res.error || !res.data) return null;
    const user = dbUserRowToApp(res.data as Record<string, unknown>);
    if (!user || normEmail(user.email) !== normEmail(email)) return null;
    return user;
  });
}

/** Indexed login lookup — avoids loading the full user roster. */
export async function readUserByEmail(email: string): Promise<AppUser | null> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb
      .from("tracker_users")
      .select("*")
      .ilike("email", normEmail(email))
      .maybeSingle();
    throwIfRetryableSupabaseError(res.error, res.status, "readUserByEmail");
    if (res.error || !res.data) return null;
    return dbUserRowToApp(res.data as Record<string, unknown>);
  });
}

export async function readUsers(): Promise<AppUser[]> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb.from("tracker_users").select("*");
    checkSupabaseResult(res, "readUsers");
    return (res.data || [])
      .map((row) => dbUserRowToApp(row as Record<string, unknown>))
      .filter((u): u is AppUser => u !== null);
  });
}
