import type { ChatRecord } from "@/lib/db/records";
import { parseTime } from "@/lib/utils/format-duration";
import type { WorkspaceUser } from "@/lib/workspace/cache";
import { sharesTeamWithUserViewer } from "@/lib/auth/scoping-users";
import {
  analystIdentityKeys,
  getUserTeamsList,
  isUnrestrictedTeamLead,
} from "@/lib/auth/scoping";
import type { SessionUser } from "@/lib/auth/constants";

export function isLeadNoteOnlyRecord(record: Partial<ChatRecord> = {}): boolean {
  if (record?.isLeadNoteOnly) return true;
  const noChatTimes =
    !record?.firstReceive &&
    !record?.firstReply &&
    !record?.clientLastReply &&
    !record?.analystLastReply;
  const noAnalystNote = !(record?.note || "").trim();
  const hasLeadNote = !!(record?.leadNote || "").trim();
  const zeroCounts =
    Number(record?.received || 0) === 0 &&
    Number(record?.attempted || 0) === 0 &&
    Number(record?.resolved || 0) === 0;
  return hasLeadNote && noAnalystNote && noChatTimes && zeroCounts;
}

export function dashboardRecordStatusLabel(r: Partial<ChatRecord>): string {
  const hasAnalystLast = !!(String(r?.analystLastReply ?? "").trim());
  const hasFirstReply = !!(String(r?.firstReply ?? "").trim());
  if (hasAnalystLast) return "Completed";
  if (!hasFirstReply) return "Awaiting reply";
  return "Ongoing";
}

export function recordMatchesDashboardSearch(
  record: Partial<ChatRecord>,
  rawQuery: string,
): boolean {
  const q = String(rawQuery ?? "").trim().toLowerCase();
  if (!q) return true;
  const status = dashboardRecordStatusLabel(record).toLowerCase();
  const parts = [
    record?.analyst,
    record?.team,
    record?.profile,
    record?.clientName,
    record?.note,
    record?.leadNote,
    record?.phone,
    record?.date,
    record?.firstReceive,
    record?.firstReply,
    record?.clientLastReply,
    record?.analystLastReply,
    record?.createdBy,
    String(record?.id ?? ""),
  ];
  if (parts.some((p) => String(p ?? "").toLowerCase().includes(q))) return true;
  return status.includes(q);
}

export function sumChatOutcomeField(
  record: Partial<ChatRecord>,
  key: "received" | "attempted" | "resolved",
): number {
  const n = Number(record?.[key]);
  return Number.isFinite(n) ? n : 0;
}

export type DashboardFilters = {
  fStart: string;
  fEnd: string;
  fHour: string;
  fAnalyst: string;
  fTeam: string;
  fProfile: string;
  fReplyStatus: string;
  searchQuery: string;
};

export const EMPTY_DASHBOARD_FILTERS: DashboardFilters = {
  fStart: "",
  fEnd: "",
  fHour: "",
  fAnalyst: "",
  fTeam: "",
  fProfile: "",
  fReplyStatus: "",
  searchQuery: "",
};

export function hasActiveDashboardFilters(filters: DashboardFilters): boolean {
  return !!(
    filters.fStart ||
    filters.fEnd ||
    filters.fHour ||
    filters.fAnalyst ||
    filters.fTeam ||
    filters.fProfile ||
    filters.fReplyStatus ||
    String(filters.searchQuery ?? "").trim()
  );
}

export function recordMatchesDashboardFilters(
  record: Partial<ChatRecord>,
  filters: DashboardFilters,
): boolean {
  if (!matchesActiveRecordFilters(record, filters)) return false;
  return recordMatchesDashboardSearch(record, filters.searchQuery);
}

export function filterRecordsByDashboardFilters(
  records: ChatRecord[],
  filters: DashboardFilters,
): ChatRecord[] {
  if (!hasActiveDashboardFilters(filters)) return records;
  return records.filter((r) => recordMatchesDashboardFilters(r, filters));
}

export function countActiveDashboardFilters(filters: DashboardFilters): number {
  let n = 0;
  if (String(filters.searchQuery ?? "").trim()) n += 1;
  if (filters.fStart) n += 1;
  if (filters.fEnd) n += 1;
  if (filters.fHour !== "" && filters.fHour != null) n += 1;
  if (filters.fAnalyst) n += 1;
  if (filters.fTeam) n += 1;
  if (filters.fProfile) n += 1;
  if (filters.fReplyStatus) n += 1;
  return n;
}

export function matchesActiveRecordFilters(
  r: Partial<ChatRecord>,
  filters: DashboardFilters,
): boolean {
  const { fStart, fEnd, fHour, fAnalyst, fTeam, fProfile, fReplyStatus } = filters;
  const analysts = typeof fAnalyst === "string" ? fAnalyst.trim() : "";
  const teams = typeof fTeam === "string" ? fTeam.trim() : "";
  const profiles = typeof fProfile === "string" ? fProfile.trim() : "";
  const replyMode =
    fReplyStatus === "noFirstReply"
      ? "awaitingFirstReply"
      : fReplyStatus === "noClose"
        ? "openNoClose"
        : fReplyStatus;

  if (fStart && String(r.date || "") < fStart) return false;
  if (fEnd && String(r.date || "") > fEnd) return false;
  if (fHour !== "" && fHour != null) {
    const t = parseTime(r.firstReceive || "");
    if (t == null || Math.floor(t / 60) !== Number(fHour)) return false;
  }
  if (analysts && String(r.analyst ?? "").trim() !== analysts) return false;
  if (teams && String(r.team ?? "").trim() !== teams) return false;
  if (profiles && String(r.profile ?? "").trim() !== profiles) return false;

  const hasFirstReply = !!(String(r.firstReply ?? "").trim());
  const hasAnalystLast = !!(String(r.analystLastReply ?? "").trim());
  if (replyMode === "awaitingFirstReply" && hasFirstReply) return false;
  if (replyMode === "openNoClose" && hasAnalystLast) return false;
  if (replyMode === "complete" && (!hasFirstReply || !hasAnalystLast)) return false;
  return true;
}

function analystLabel(user: Partial<WorkspaceUser>): string {
  return (user?.name || "").trim() || (user?.email || "").trim();
}

function getUserProfiles(user: Partial<WorkspaceUser>): string[] {
  return Array.isArray(user?.profileNames) ? user.profileNames : [];
}

function analystWorksOnTeamsOfLeadInRecords(
  lead: SessionUser,
  analystUser: WorkspaceUser,
  records: ChatRecord[],
): boolean {
  const leadTeams = new Set(getUserTeamsList(lead).map((t) => t.toLowerCase()));
  if (!leadTeams.size) return false;
  const keys = analystIdentityKeys(analystUser);
  return records.some((r) => {
    const team = String(r.team ?? "").trim().toLowerCase();
    const who = String(r.analyst ?? "").trim().toLowerCase();
    return who && keys.has(who) && leadTeams.has(team);
  });
}

export function buildFilterOptions(
  user: SessionUser,
  records: ChatRecord[],
  users: WorkspaceUser[],
  teamsCatalog: string[],
  profilesCatalog: string[],
) {
  const role = user.role;
  const teamLeadRestricted =
    role === "teamLead" && !isUnrestrictedTeamLead(user);

  let analysts: string[];
  if (role === "analyst") {
    analysts = [analystLabel(user)].filter(Boolean);
  } else {
    const analystInScope = (u: WorkspaceUser) => {
      if (u.role !== "analyst") return false;
      if (role === "mainTeamLead") {
        return (
          sharesTeamWithUserViewer(user, u) ||
          analystWorksOnTeamsOfLeadInRecords(user, u, records)
        );
      }
      if (role === "teamLead" && teamLeadRestricted) {
        return (
          sharesTeamWithUserViewer(user, u) ||
          analystWorksOnTeamsOfLeadInRecords(user, u, records)
        );
      }
      return true;
    };
    const fromUsers = users.filter(analystInScope).map(analystLabel).filter(Boolean);
    analysts = [
      ...new Set([...records.map((r) => r.analyst).filter(Boolean), ...fromUsers]),
    ];
  }

  const mergedTeams = [
    ...new Set([...records.map((r) => r.team).filter(Boolean), ...teamsCatalog]),
  ];
  let teams = mergedTeams;
  if (role === "analyst" || role === "mainTeamLead" || teamLeadRestricted) {
    const allowed = new Set(getUserTeamsList(user).map((t) => t.toLowerCase()));
    if (allowed.size) {
      teams = mergedTeams.filter((t) => allowed.has(String(t).trim().toLowerCase()));
    } else if (role === "mainTeamLead" || teamLeadRestricted) {
      teams = [];
    }
  }

  let profiles: string[];
  if (role === "analyst") {
    profiles = [...getUserProfiles(user)].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  } else if (role === "mainTeamLead") {
    const leadTeams = new Set(getUserTeamsList(user).map((t) => t.toLowerCase()));
    const seen = new Set<string>();
    profiles = [];
    if (leadTeams.size) {
      for (const u of users) {
        if (!getUserTeamsList(u).some((t) => leadTeams.has(t.toLowerCase()))) continue;
        for (const p of getUserProfiles(u)) {
          const trimmed = String(p || "").trim();
          const key = trimmed.toLowerCase();
          if (!trimmed || seen.has(key)) continue;
          seen.add(key);
          profiles.push(trimmed);
        }
      }
      profiles.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
    }
  } else {
    const seen = new Set<string>();
    profiles = [];
    for (const name of profilesCatalog) {
      const trimmed = String(name || "").trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) continue;
      seen.add(key);
      profiles.push(trimmed);
    }
    for (const u of users) {
      for (const p of getUserProfiles(u)) {
        const trimmed = String(p || "").trim();
        const key = trimmed.toLowerCase();
        if (!trimmed || seen.has(key)) continue;
        seen.add(key);
        profiles.push(trimmed);
      }
    }
    profiles.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  return { analysts, teams, profiles };
}
