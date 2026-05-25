import type { SessionUser } from "@/lib/auth/constants";
import { getUserTeamsList } from "@/lib/auth/scoping";
import type { ChatRecord } from "@/lib/db/records";
import type { WorkspaceUser } from "@/lib/workspace/cache";
import { memberProfiles } from "@/lib/admin/helpers";

export const ANALYST_NOTES_PAGE_SIZE = 20;

export function buildTeamLeadUsers(
  users: WorkspaceUser[],
  viewer: SessionUser,
): WorkspaceUser[] {
  const currentTeams = new Set(
    getUserTeamsList(viewer).map((t) => t.toLowerCase()),
  );
  return users.filter(
    (u) =>
      u.role === "teamLead" &&
      getUserTeamsList(u).some((t) => currentTeams.has(t.toLowerCase())),
  );
}

export function buildMainLeadMemberProfilesCatalog(
  viewer: SessionUser,
  users: WorkspaceUser[],
): string[] {
  const leadTeams = new Set(
    getUserTeamsList(viewer)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!leadTeams.size) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of users) {
    if (!u) continue;
    const overlaps = getUserTeamsList(u).some((t) =>
      leadTeams.has(String(t).trim().toLowerCase()),
    );
    if (!overlaps) continue;
    for (const p of memberProfiles(u)) {
      const key = String(p).trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(String(p).trim());
    }
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out;
}

export function filterAnalystNotesRows(
  records: ChatRecord[],
  profileFilter = "",
): ChatRecord[] {
  const wanted = String(profileFilter || "").trim().toLowerCase();
  return records
    .filter((r) => (r.note || "").trim())
    .filter(
      (r) => !wanted || String(r.profile || "").trim().toLowerCase() === wanted,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function filterMainLeadNotesRows(
  records: ChatRecord[],
  profileFilter = "",
): ChatRecord[] {
  const wanted = String(profileFilter || "").trim().toLowerCase();
  return records
    .filter((r) => (r.leadNote || "").trim())
    .filter(
      (r) => !wanted || String(r.profile || "").trim().toLowerCase() === wanted,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function paginateRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
): {
  slice: T[];
  activePage: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
} {
  const totalPages = Math.ceil(rows.length / pageSize);
  const activePage = Math.min(page, Math.max(totalPages - 1, 0));
  const slice = rows.slice(activePage * pageSize, (activePage + 1) * pageSize);
  const rangeStart = rows.length === 0 ? 0 : activePage * pageSize + 1;
  const rangeEnd =
    rows.length === 0
      ? 0
      : Math.min(rows.length, (activePage + 1) * pageSize);
  return { slice, activePage, totalPages, rangeStart, rangeEnd };
}

export function matchRecordsForMainLeadNote(
  baseList: ChatRecord[],
  {
    team,
    profilePick,
    clientName,
    clientPhone,
  }: {
    team: string;
    profilePick: string;
    clientName: string;
    clientPhone: string;
  },
): ChatRecord[] {
  return baseList.filter((r) => {
    const teamMatch = (r.team || "").toLowerCase() === team.toLowerCase();
    if (!teamMatch) return false;
    if (profilePick) {
      const rp = (r.profile || "").trim().toLowerCase();
      if (rp !== profilePick.toLowerCase()) return false;
    }
    if (clientPhone) {
      return (r.phone || "").trim().toLowerCase() === clientPhone.toLowerCase();
    }
    if (!clientName) {
      return !!profilePick;
    }
    const q = clientName.toLowerCase();
    const p = (r.profile || "").trim().toLowerCase();
    const c = (r.clientName || "").trim().toLowerCase();
    return p === q || c === q;
  });
}
