import type { AppUser } from "@/lib/db/users";
import { getUserTeamsList, isUnrestrictedTeamLead, viewerTeamLcSet } from "@/lib/auth/scoping";
import { makeDisplayName } from "@/lib/utils/display-name";
import {
  PAYMENT_LIMITS,
  type PaymentRecordFieldErrors,
  type PaymentRecordInput,
} from "./types";

/**
 * Access rules for Payment Records (separate from chat records).
 *
 * - analyst (Chat Analyst): adds records for themselves and sees only their own.
 *   Can never edit or delete, even their own.
 * - mainTeamLead (Team Lead): adds, views all, edits and deletes. Sees the Top
 *   Payment Receiver panel.
 * - teamLead (Chat Analyst Team Lead): read-only. Sees records added by chat
 *   analysts, limited to their own teams (a super admin sees all teams).
 *   Cannot add, edit or delete.
 */
type Viewer = Partial<AppUser>;
type Row = { team?: string; createdByUserId?: string; createdByRole?: string };

const lc = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function isPaymentOwner(viewer: Viewer, row: Row): boolean {
  const id = String(viewer?.id ?? "").trim();
  return Boolean(id) && String(row.createdByUserId ?? "").trim() === id;
}

/** Whether the viewer may see this row at all. */
export function paymentVisibleToViewer(viewer: Viewer, row: Row): boolean {
  if (!viewer?.role) return false;
  if (viewer.role === "analyst") return isPaymentOwner(viewer, row);
  if (viewer.role === "mainTeamLead") return true;
  if (viewer.role === "teamLead") {
    if (row.createdByRole !== "analyst") return false;
    return isUnrestrictedTeamLead(viewer) || viewerTeamLcSet(viewer).has(lc(row.team));
  }
  return false;
}

/** Has the Payment Records page at all. */
export function canViewPaymentPage(viewer: Viewer): boolean {
  return viewer?.role === "analyst" || viewer?.role === "mainTeamLead" || viewer?.role === "teamLead";
}

export function canAddPayment(viewer: Viewer): boolean {
  return viewer?.role === "analyst" || viewer?.role === "mainTeamLead";
}

/** Edit and delete: Team Lead (mainTeamLead) only. */
export function canManagePayment(viewer: Viewer, row: Row): boolean {
  return viewer?.role === "mainTeamLead" && paymentVisibleToViewer(viewer, row);
}

/** Top Payment Receiver panel: Team Lead (mainTeamLead) only. */
export function canSeeTopReceivers(viewer: Viewer): boolean {
  return viewer?.role === "mainTeamLead";
}

/**
 * Applies the viewer's limits to a validated payload before it is written.
 * Analysts can only record payments for themselves, on their own teams and
 * assigned profiles; the Team Lead may record any team / profile / analyst.
 */
export function applyPaymentViewerRules(
  viewer: Viewer,
  value: PaymentRecordInput,
): { value: PaymentRecordInput; errors: PaymentRecordFieldErrors } {
  if (viewer?.role !== "analyst") return { value, errors: {} };

  const errors: PaymentRecordFieldErrors = {};
  const out = { ...value };

  const team = getUserTeamsList(viewer).find((t) => lc(t) === lc(value.team));
  if (team) out.team = team;
  else errors.team = "Select one of your teams.";

  const profiles = Array.isArray(viewer.profileNames) ? viewer.profileNames : [];
  if (profiles.length) {
    const profile = profiles.find((p) => lc(p) === lc(value.profile));
    if (profile) out.profile = profile;
    else errors.profile = "Select one of your assigned profiles.";
  }

  out.analyst = makeDisplayName(viewer as never).slice(0, PAYMENT_LIMITS.name);
  return { value: out, errors };
}
