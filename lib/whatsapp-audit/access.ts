import type { AppUser } from "@/lib/db/users";
import { isUnrestrictedTeamLead, viewerTeamLcSet } from "@/lib/auth/scoping";

/**
 * Access rules for WhatsApp Audit (separate from chat records).
 *
 * - analyst: logs entries for their own teams, sees and edits only their own entries.
 * - mainTeamLead: sees entries for their teams; can change Category.
 * - teamLead (super admin / isAdmin): sees all entries; can edit, re-categorise and delete any.
 * - teamLead (not admin): API access scoped to their teams (category + delete), no page tab.
 */
type Viewer = Partial<AppUser>;
type AuditRow = { team?: string; createdByUserId?: string };

const lc = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function isAuditOwner(viewer: Viewer, row: AuditRow): boolean {
  const id = String(viewer?.id ?? "").trim();
  return Boolean(id) && String(row.createdByUserId ?? "").trim() === id;
}

/** Whether the viewer may see this row at all. */
export function auditVisibleToViewer(viewer: Viewer, row: AuditRow): boolean {
  if (!viewer?.role) return false;
  if (viewer.role === "analyst") return isAuditOwner(viewer, row);
  if (isUnrestrictedTeamLead(viewer)) return true;
  if (viewer.role === "mainTeamLead" || viewer.role === "teamLead") {
    return viewerTeamLcSet(viewer).has(lc(row.team));
  }
  return false;
}

/** Review page (table): main team leads and super admins. */
export function canViewAuditPage(viewer: Viewer): boolean {
  return viewer?.role === "mainTeamLead" || isUnrestrictedTeamLead(viewer);
}

/** Creating entries: analysts (form page) and leads via API, for teams they belong to. */
export function canCreateAuditForTeam(viewer: Viewer, team: string): boolean {
  if (!viewer?.role) return false;
  if (isUnrestrictedTeamLead(viewer)) return true;
  if (viewer.role === "analyst" || viewer.role === "mainTeamLead" || viewer.role === "teamLead") {
    return viewerTeamLcSet(viewer).has(lc(team));
  }
  return false;
}

/** Changing Category on a visible row. */
export function canSetAuditCategory(viewer: Viewer, row: AuditRow): boolean {
  if (!auditVisibleToViewer(viewer, row)) return false;
  return (
    viewer.role === "mainTeamLead" ||
    viewer.role === "teamLead" ||
    (viewer.role === "analyst" && isAuditOwner(viewer, row))
  );
}

/** Editing every field: the analyst who logged it, or a super admin. */
export function canEditAuditFields(viewer: Viewer, row: AuditRow): boolean {
  if (!auditVisibleToViewer(viewer, row)) return false;
  return isUnrestrictedTeamLead(viewer) || (viewer.role === "analyst" && isAuditOwner(viewer, row));
}

/** Deleting: team leads (super admin any row, others within their teams), same as chat records. */
export function canDeleteAudit(viewer: Viewer, row: AuditRow): boolean {
  if (!auditVisibleToViewer(viewer, row)) return false;
  return viewer.role === "teamLead";
}
