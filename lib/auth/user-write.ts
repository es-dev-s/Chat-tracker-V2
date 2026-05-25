import type { AppUser } from "@/lib/db/users";
import { isUnrestrictedTeamLead } from "./scoping";
import { teamLeadMayManageMember } from "./scoping-users";

export function viewerMayDeleteUserAccount(
  viewer: Partial<AppUser>,
  target: Partial<AppUser>,
  allRecordsFull: Record<string, unknown>[],
): boolean {
  if (!viewer?.role || !target?.role || viewer.role !== "teamLead") return false;
  if (target.role === "teamLead") return false;
  if (isUnrestrictedTeamLead(viewer)) return true;
  return teamLeadMayManageMember(viewer, target, allRecordsFull);
}

export function viewerMaySeeUserPassword(
  viewer: Partial<AppUser>,
  target: Partial<AppUser>,
  allRecordsFull: Record<string, unknown>[],
): boolean {
  if (!viewer || !target) return false;
  if (String(viewer.id) === String(target.id)) return true;
  if (viewer.role === "teamLead" && isUnrestrictedTeamLead(viewer)) return true;
  if (viewer.role === "teamLead") {
    return teamLeadMayManageMember(viewer, target, allRecordsFull);
  }
  return false;
}
