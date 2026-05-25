import type { SessionUser } from "@/lib/auth/constants";
import { getUserTeamsList } from "@/lib/auth/scoping";
import {
  analystWorksOnTeamsOfLeadInRecords,
  sharesTeamWithUserViewer,
} from "@/lib/auth/scoping-users";
import type { ChatRecord } from "@/lib/db/records";
import type { WorkspaceUser } from "@/lib/workspace/cache";

export function memberTeams(user: Partial<WorkspaceUser>): string[] {
  return getUserTeamsList(user);
}

export function memberProfiles(user: Partial<WorkspaceUser>): string[] {
  const names = Array.isArray(user?.profileNames) ? user.profileNames : [];
  return [...new Set(names.map((name) => String(name).trim()).filter(Boolean))];
}

function roleLabelForCopy(role: string | undefined): string {
  if (role === "mainTeamLead") return "Main Team Lead";
  if (role === "analyst") return "Chat Analyst";
  if (role === "teamLead") return "Team Lead";
  return role?.trim() || "—";
}

/** Plain-text block for sharing login details (email, password, teams, profiles). */
export function formatUserCredentialsText(user: Partial<WorkspaceUser>): string {
  const teamsText = memberTeams(user).join(", ") || "—";
  const profilesText = memberProfiles(user).join(", ") || "—";
  const pw = String(user.password ?? "").trim() || "—";
  return [
    `Role: ${roleLabelForCopy(user.role)}`,
    `Name: ${String(user.name ?? "").trim() || "—"}`,
    `Email: ${String(user.email ?? "").trim() || "—"}`,
    `Password: ${pw}`,
    `Team(s): ${teamsText}`,
    `Profile(s): ${profilesText}`,
  ].join("\n");
}

export function maskedPasswordPreview(pw: unknown): string {
  const s = String(pw ?? "");
  if (!s) return "—";
  const head = s.slice(0, Math.min(3, s.length));
  const restHidden = Math.max(0, s.length - 3);
  const padShort = s.length < 3 ? "*".repeat(3 - s.length) : "";
  return head + (restHidden ? "*".repeat(restHidden) : padShort);
}

export function buildAdminAnalystRows(
  viewer: SessionUser,
  users: WorkspaceUser[],
  records: ChatRecord[],
  restricted: boolean,
): WorkspaceUser[] {
  const analysts = users.filter((u) => u.role === "analyst");
  if (!restricted) return analysts;
  return analysts.filter(
    (u) =>
      sharesTeamWithUserViewer(viewer, u) ||
      analystWorksOnTeamsOfLeadInRecords(viewer, u, records),
  );
}

export function buildAdminMainLeadRows(
  viewer: SessionUser,
  users: WorkspaceUser[],
  restricted: boolean,
): WorkspaceUser[] {
  const leads = users.filter((u) => u.role === "mainTeamLead");
  if (!restricted) return leads;
  return leads.filter((u) => sharesTeamWithUserViewer(viewer, u));
}
