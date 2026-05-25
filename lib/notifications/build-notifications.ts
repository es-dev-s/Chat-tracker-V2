import type { ChatRecord } from "@/lib/db/records";
import { TAB_TO_PATH } from "@/lib/auth/routes";

export { tabLabel } from "@/lib/layout/tab-meta";

export type NotificationItem = {
  id: string;
  type: "analyst" | "lead";
  at: string;
  recordId: number;
  recordDate: string;
  team: string;
  profile: string;
  rowAnalyst: string;
  targetPath: string;
};

export const NOTIFICATIONS_POPOVER_LIMIT = 5;

export function recordProfileClientLine(record: Partial<ChatRecord> = {}): string {
  const p = (record.profile || "").trim();
  const c = (record.clientName || "").trim();
  if (p && c) return `${p} · ${c}`;
  return p || c;
}

export function buildNotifications(
  records: ChatRecord[],
  dismissedIds: string[],
  role: string,
): NotificationItem[] {
  const dismissed = new Set(dismissedIds);
  const targetForAnalyst: Record<string, string> = {
    mainTeamLead: TAB_TO_PATH.leads,
    teamLead: TAB_TO_PATH.dashboard,
    analyst: TAB_TO_PATH.dashboard,
  };
  const targetForLead: Record<string, string> = {
    mainTeamLead: TAB_TO_PATH.leadNotes,
    teamLead: TAB_TO_PATH.notes,
    analyst: TAB_TO_PATH.notes,
  };

  return records
    .flatMap((r) => {
      const items: NotificationItem[] = [];
      if ((r.note || "").trim() && r.noteUpdatedAt) {
        items.push({
          id: `analyst-${r.id}-${r.noteUpdatedAt}`,
          type: "analyst",
          at: r.noteUpdatedAt,
          recordId: r.id,
          recordDate: (r.date && String(r.date).trim()) || "—",
          team: (r.team && String(r.team).trim()) || "—",
          profile: recordProfileClientLine(r) || "—",
          rowAnalyst: (r.analyst && String(r.analyst).trim()) || "—",
          targetPath: targetForAnalyst[role] ?? TAB_TO_PATH.dashboard,
        });
      }
      if ((r.leadNote || "").trim() && r.leadNoteUpdatedAt) {
        items.push({
          id: `lead-${r.id}-${r.leadNoteUpdatedAt}`,
          type: "lead",
          at: r.leadNoteUpdatedAt,
          recordId: r.id,
          recordDate: (r.date && String(r.date).trim()) || "—",
          team: (r.team && String(r.team).trim()) || "—",
          profile: recordProfileClientLine(r) || "—",
          rowAnalyst: (r.analyst && String(r.analyst).trim()) || "—",
          targetPath: targetForLead[role] ?? TAB_TO_PATH.notes,
        });
      }
      return items;
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .filter((n) => !dismissed.has(n.id));
}
