import type { AppUser } from "../db/users";
import { normEmail } from "../db/users";

export type RecordLike = {
  id?: unknown;
  analyst?: string;
  team?: string;
  leadNote?: string;
  note?: string;
  noteUpdatedAt?: string | null;
  leadNoteUpdatedAt?: string | null;
  date?: string;
  profile?: string;
  clientName?: string;
};

function uniqCaseInsensitive(arr: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of arr) {
    const t = String(raw ?? "").trim();
    const key = t.toLowerCase();
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function getUserTeamsList(user: Partial<AppUser> = {}): string[] {
  const multi = Array.isArray(user?.teamNames) ? user.teamNames : [];
  const single = typeof user?.teamName === "string" ? [user.teamName] : [];
  return uniqCaseInsensitive([...multi, ...single]);
}

export function viewerTeamLcSet(viewer: Partial<AppUser>): Set<string> {
  return new Set(getUserTeamsList(viewer).map((t) => t.toLowerCase()));
}

export function isUnrestrictedTeamLead(viewer: Partial<AppUser>): boolean {
  return viewer?.role === "teamLead" && viewer?.isAdmin === true;
}

export function analystIdentityKeys(user: Partial<AppUser> = {}): Set<string> {
  const name = (user?.name || "").trim().toLowerCase();
  const email = normEmail(user?.email || "");
  return new Set([name, email].filter(Boolean));
}

export function filterRecordsForViewer(
  viewer: Partial<AppUser>,
  rows: RecordLike[],
): RecordLike[] {
  if (!viewer?.role || !Array.isArray(rows)) return [];
  const role = viewer.role;

  if (role === "analyst") {
    const allowed = analystIdentityKeys(viewer);
    const currentTeams = viewerTeamLcSet(viewer);
    return rows.filter((r) => {
      const analystMatch = allowed.has(String(r.analyst ?? "").trim().toLowerCase());
      const teamLeadNoteMatch =
        !!(r.leadNote || "").trim() &&
        currentTeams.has(String(r.team ?? "").trim().toLowerCase());
      return analystMatch || teamLeadNoteMatch;
    });
  }

  if (role === "mainTeamLead") {
    const currentTeams = viewerTeamLcSet(viewer);
    return rows.filter((r) =>
      currentTeams.has(String(r.team ?? "").trim().toLowerCase()),
    );
  }

  if (role === "teamLead") {
    if (isUnrestrictedTeamLead(viewer)) return [...rows];
    const currentTeams = viewerTeamLcSet(viewer);
    if (!currentTeams.size) return [];
    return rows.filter((r) =>
      currentTeams.has(String(r.team ?? "").trim().toLowerCase()),
    );
  }

  return [];
}

export function notifUserKey(viewer: Partial<AppUser>): string {
  const r = String(viewer?.role || "");
  const e = normEmail(viewer?.email || "");
  return `${r}:${e}`;
}
