import type { AppUser } from "@/lib/db/users";
import { getUserTeamsList, isUnrestrictedTeamLead } from "./scoping";
import { teamLeadMayManageMember } from "./scoping-users";

function uniqTeams(arr: string[]): string[] {
  return [...new Set((Array.isArray(arr) ? arr : []).map((t) => String(t).trim()).filter(Boolean))];
}

export function mergeTeamsCatalog(
  viewer: Partial<AppUser>,
  existing: string[],
  incoming: string[],
): string[] {
  const existingArr = uniqTeams(existing);
  const inc = uniqTeams(incoming);

  if (viewer?.role === "mainTeamLead") {
    const allowed = new Set(getUserTeamsList(viewer).map((t) => t.toLowerCase()));
    const base = new Set(existingArr.map((t) => t.toLowerCase()));
    for (const t of inc) {
      const tl = t.toLowerCase();
      if (!base.has(tl) && !allowed.has(tl)) throw new Error("FORBIDDEN_TEAM_NAME");
    }
    return uniqTeams([...existingArr, ...inc]);
  }

  if (viewer?.role !== "teamLead") throw new Error("TEAMS_FORBIDDEN");

  if (isUnrestrictedTeamLead(viewer)) {
    return uniqTeams([...existingArr, ...inc]);
  }

  const allowedLead = new Set(getUserTeamsList(viewer).map((t) => t.toLowerCase()));
  const baseLead = new Set(existingArr.map((t) => t.toLowerCase()));
  for (const t of inc) {
    const tl = t.toLowerCase();
    if (!baseLead.has(tl) && !allowedLead.has(tl)) throw new Error("FORBIDDEN_TEAM_NAME");
  }
  return uniqTeams([...existingArr, ...inc]);
}

export function assertTeamLeadMayUpsertUser(
  viewer: Partial<AppUser>,
  prev: Partial<AppUser> | null,
  next: Partial<AppUser>,
  allRecordsFull: Record<string, unknown>[],
): void {
  if (viewer?.role !== "teamLead") throw new Error("USERS_FORBIDDEN");
  if (isUnrestrictedTeamLead(viewer)) return;
  if (prev) {
    if (!teamLeadMayManageMember(viewer, prev, allRecordsFull)) {
      throw new Error("USER_OUT_OF_SCOPE");
    }
  }
  if (!teamLeadMayManageMember(viewer, next, allRecordsFull)) {
    throw new Error(prev ? "USER_OUT_OF_SCOPE" : "USER_CREATE_OUT_OF_SCOPE");
  }
}

export function computeTeamCatalogAfterAdd(
  viewer: Partial<AppUser>,
  existingNames: string[],
  newName: string,
): string[] {
  const trimmed = String(newName || "").trim();
  if (!trimmed) throw new Error("TEAM_NAME_REQUIRED");
  const existingArr = uniqTeams(existingNames);
  if (isUnrestrictedTeamLead(viewer)) {
    return uniqTeams([...existingArr, trimmed]);
  }
  return mergeTeamsCatalog(viewer, existingArr, [trimmed]);
}

export function assertTeamLeadMayDeleteTeamName(
  viewer: Partial<AppUser>,
  existingNames: string[],
  teamName: string,
): void {
  const trimmed = String(teamName || "").trim();
  if (!trimmed) throw new Error("TEAM_NAME_REQUIRED");
  const existingArr = uniqTeams(existingNames);
  if (!existingArr.includes(trimmed)) {
    throw new Error("TEAM_NOT_IN_CATALOG");
  }
  const tl = trimmed.toLowerCase();

  if (viewer?.role === "mainTeamLead") {
    const allowed = new Set(getUserTeamsList(viewer).map((t) => t.toLowerCase()));
    const base = new Set(existingArr.map((t) => t.toLowerCase()));
    if (!base.has(tl) && !allowed.has(tl)) throw new Error("FORBIDDEN_TEAM_NAME");
    return;
  }
  if (viewer?.role !== "teamLead") throw new Error("TEAMS_FORBIDDEN");
  if (isUnrestrictedTeamLead(viewer)) return;
  const allowedLead = new Set(getUserTeamsList(viewer).map((t) => t.toLowerCase()));
  if (!allowedLead.has(tl)) throw new Error("FORBIDDEN_TEAM_NAME");
}
