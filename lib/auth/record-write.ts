import type { AppUser } from "@/lib/db/users";
import {
  analystIdentityKeys,
  getUserTeamsList,
  isUnrestrictedTeamLead,
  viewerTeamLcSet,
} from "./scoping";

export const MAIN_TEAM_LEAD_PATCHABLE_FIELDS = new Set([
  "leadNote",
  "leadNoteUpdatedAt",
  "leadNoteUpdatedBy",
]);

type RecordRow = Record<string, unknown>;

function teamAllowedForRecord(viewer: Partial<AppUser>, team: unknown): boolean {
  const t = String(team ?? "").trim().toLowerCase();
  if (!t) return false;
  return viewerTeamLcSet(viewer).has(t);
}

function recordFieldChanged(a: unknown, b: unknown): boolean {
  const na = a === undefined || a === null ? null : a;
  const nb = b === undefined || b === null ? null : b;
  if (na === nb) return false;
  try {
    return JSON.stringify(na) !== JSON.stringify(nb);
  } catch {
    return na !== nb;
  }
}

function mainTeamLeadLeadNoteOnlyInsertAllowed(
  viewer: Partial<AppUser>,
  row: RecordRow,
): boolean {
  if (!teamAllowedForRecord(viewer, row.team)) return false;
  if (!row.isLeadNoteOnly) return false;
  if (String(row.note ?? "").trim() !== "") return false;
  if (String(row.leadNote ?? "").trim() === "") return false;
  if (String(row.analyst ?? "").trim() !== "") return false;
  for (const k of [
    "firstReceive",
    "firstReply",
    "clientLastReply",
    "analystLastReply",
    "firstChatScreenshot",
    "lastChatScreenshot",
  ]) {
    if (String(row[k] ?? "").trim() !== "") return false;
  }
  if (Number(row.received) !== 0 || Number(row.attempted) !== 0 || Number(row.resolved) !== 0) {
    return false;
  }
  if (row.replyDiff != null || row.totalConv != null) return false;
  if (row.noteUpdatedAt != null) return false;
  const nub = row.noteUpdatedBy;
  if (nub != null && String(nub).trim() !== "") return false;
  return true;
}

function mainTeamLeadPatchAllowed(
  viewer: Partial<AppUser>,
  row: RecordRow,
  existingRow: RecordRow,
): { ok: true } | { ok: false; code: "FIELD_FORBIDDEN" | "RECORD_OUT_OF_SCOPE" } {
  const rowTeam = String(row.team ?? "").trim().toLowerCase();
  const exTeam = String(existingRow.team ?? "").trim().toLowerCase();
  if (rowTeam !== exTeam) return { ok: false, code: "FIELD_FORBIDDEN" };
  const keys = new Set([...Object.keys(row), ...Object.keys(existingRow)]);
  for (const k of keys) {
    if (k === "id") continue;
    if (!recordFieldChanged(row[k], existingRow[k])) continue;
    if (!MAIN_TEAM_LEAD_PATCHABLE_FIELDS.has(k)) return { ok: false, code: "FIELD_FORBIDDEN" };
  }
  return { ok: true };
}

export function checkViewerMayCommitRecord(
  viewer: Partial<AppUser>,
  row: RecordRow,
  existingRow?: RecordRow | null,
):
  | { ok: true }
  | { ok: false; code: "RECORD_OUT_OF_SCOPE" | "FIELD_FORBIDDEN" } {
  if (!viewer?.role || row == null) return { ok: false, code: "RECORD_OUT_OF_SCOPE" };

  if (viewer.role === "mainTeamLead") {
    if (existingRow == null || existingRow === undefined) {
      return mainTeamLeadLeadNoteOnlyInsertAllowed(viewer, row)
        ? { ok: true }
        : { ok: false, code: "RECORD_OUT_OF_SCOPE" };
    }
    return mainTeamLeadPatchAllowed(viewer, row, existingRow);
  }

  if (viewer.role === "teamLead") {
    if (isUnrestrictedTeamLead(viewer)) return { ok: true };
    return teamAllowedForRecord(viewer, row.team)
      ? { ok: true }
      : { ok: false, code: "RECORD_OUT_OF_SCOPE" };
  }

  if (viewer.role === "analyst") {
    const keys = analystIdentityKeys(viewer);
    const ana = String(row.analyst ?? "").trim().toLowerCase();
    if (!(keys.has(ana) && ana)) return { ok: false, code: "RECORD_OUT_OF_SCOPE" };
    const teamLc = String(row.team ?? "").trim().toLowerCase();
    if (!getUserTeamsList(viewer).some((x) => String(x).trim().toLowerCase() === teamLc)) {
      return { ok: false, code: "RECORD_OUT_OF_SCOPE" };
    }
    return { ok: true };
  }

  return { ok: false, code: "RECORD_OUT_OF_SCOPE" };
}

export function viewerMayDeleteChatRecord(
  viewer: Partial<AppUser>,
  row: RecordRow,
): boolean {
  if (!viewer?.role || !row) return false;
  if (viewer.role !== "teamLead") return false;
  if (isUnrestrictedTeamLead(viewer)) return true;
  return viewerTeamLcSet(viewer).has(String(row.team ?? "").trim().toLowerCase());
}
