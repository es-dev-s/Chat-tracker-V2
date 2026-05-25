import type { AppUser } from "../db/users";
import { normEmail, stripPassword } from "../db/users";
import type { RecordLike } from "./scoping";
import {
  analystIdentityKeys,
  getUserTeamsList,
  isUnrestrictedTeamLead,
  viewerTeamLcSet,
} from "./scoping";

export function analystWorksOnTeamsOfLeadInRecords(
  lead: Partial<AppUser>,
  analystUser: Partial<AppUser>,
  allRecords: RecordLike[],
): boolean {
  const leadTeams = new Set(
    getUserTeamsList(lead).map((t) => t.toLowerCase()).filter(Boolean),
  );
  if (!leadTeams.size || !Array.isArray(allRecords)) return false;
  const keys = analystIdentityKeys(analystUser);
  return allRecords.some((r) => {
    const team = String(r.team ?? "").trim().toLowerCase();
    const who = String(r.analyst ?? "").trim().toLowerCase();
    return who && keys.has(who) && leadTeams.has(team);
  });
}

export function sharesTeamWithUserViewer(
  viewer: Partial<AppUser>,
  assignee: Partial<AppUser>,
): boolean {
  if (!assignee?.role || assignee.role === "teamLead") return false;
  const allowed = viewerTeamLcSet(viewer);
  if (!allowed.size) return false;
  return getUserTeamsList(assignee).some((t) =>
    allowed.has(String(t).trim().toLowerCase()),
  );
}

export function teamLeadMayManageMember(
  viewer: Partial<AppUser>,
  target: Partial<AppUser>,
  allRecordsFull: RecordLike[],
): boolean {
  if (!(viewer?.role === "teamLead" && target && target.role !== "teamLead")) {
    return false;
  }
  if (isUnrestrictedTeamLead(viewer)) return true;
  if (sharesTeamWithUserViewer(viewer, target)) return true;
  return !!(
    target.role === "analyst" &&
    analystWorksOnTeamsOfLeadInRecords(viewer, target, allRecordsFull || [])
  );
}

function viewerMaySeeUserPassword(
  viewer: Partial<AppUser>,
  target: Partial<AppUser>,
  allRecordsFull: RecordLike[],
): boolean {
  if (!viewer || !target) return false;
  if (String(viewer.id) === String(target.id)) return true;
  if (viewer.role === "teamLead" && isUnrestrictedTeamLead(viewer)) return true;
  if (viewer.role === "teamLead") {
    return teamLeadMayManageMember(viewer, target, allRecordsFull);
  }
  return false;
}

export function filterUsersDirectoryForViewer(
  viewer: Partial<AppUser>,
  allUsers: AppUser[],
  allRecordsFull: RecordLike[],
): AppUser[] {
  if (!viewer?.role || !Array.isArray(allUsers)) return [];
  const out: AppUser[] = [];

  for (const tgt of allUsers) {
    if (!tgt) continue;
    let allowed = false;

    if (viewer.role === "analyst") {
      allowed = String(tgt.id) === String(viewer.id);
    } else if (viewer.role === "mainTeamLead") {
      const currentTeams = viewerTeamLcSet(viewer);
      if (String(tgt.id) === String(viewer.id)) allowed = true;
      else if (
        tgt.role === "teamLead" &&
        getUserTeamsList(tgt).some((t) => currentTeams.has(t.toLowerCase()))
      ) {
        allowed = true;
      }
    } else if (viewer.role === "teamLead") {
      if (isUnrestrictedTeamLead(viewer)) allowed = true;
      else if (
        String(tgt.id) === String(viewer.id) ||
        teamLeadMayManageMember(viewer, tgt, allRecordsFull)
      ) {
        allowed = true;
      }
    }

    if (!allowed) continue;
    out.push(
      viewerMaySeeUserPassword(viewer, tgt, allRecordsFull) ? tgt : stripPassword(tgt),
    );
  }
  return out;
}

export function filterTeamsListForViewer(
  viewer: Partial<AppUser>,
  rosterNames: string[],
  scopedRecords: RecordLike[],
): string[] {
  const roster = Array.isArray(rosterNames) ? rosterNames : [];
  const fromScoped = [
    ...new Set((scopedRecords || []).map((r) => r.team).filter(Boolean) as string[]),
  ];
  const merged = [...new Set([...fromScoped, ...roster])];
  const role = viewer?.role || "";
  if (role !== "teamLead" || isUnrestrictedTeamLead(viewer)) return merged;
  const allowed = viewerTeamLcSet(viewer);
  if (!allowed.size) return [];
  return merged.filter((t) => allowed.has(String(t).trim().toLowerCase()));
}
