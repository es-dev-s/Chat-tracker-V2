"use client";

import { useMemo } from "react";
import NotesTabsPanel from "@/components/notes/NotesTabsPanel";
import { useWorkspaceHydration } from "@/hooks/useWorkspaceHydration";
import { useFilteredRecords } from "@/hooks/useFilteredRecords";
import { NotesPanelSkeleton } from "@/components/ui/WorkspaceSkeletons";
import { filterRecordsForViewer } from "@/lib/auth/scoping";
import { isLeadNoteOnlyRecord } from "@/lib/dashboard/records";
import type { ChatRecord } from "@/lib/db/records";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function NotesView() {
  const user = useAuthStore((s) => s.user);
  const records = useWorkspaceStore((s) => s.records);
  const users = useWorkspaceStore((s) => s.users);
  const { showSkeleton } = useWorkspaceHydration();

  const role = user?.role ?? "analyst";

  const visibleRecords = useMemo(
    () => filterRecordsForViewer(user!, records) as ChatRecord[],
    [user, records],
  );

  const filteredRecords = useFilteredRecords(visibleRecords);

  const analystNotesRows = useMemo(
    () =>
      filteredRecords
        .filter((r) => !isLeadNoteOnlyRecord(r))
        .filter((r) => (r.note || "").trim())
        .sort((a, b) => b.date.localeCompare(a.date)),
    [filteredRecords],
  );

  const mainLeadNotesRows = useMemo(
    () =>
      filteredRecords
        .filter((r) => (r.leadNote || "").trim())
        .sort((a, b) => b.date.localeCompare(a.date)),
    [filteredRecords],
  );

  if (!user || role === "mainTeamLead") return null;

  return (
    <div>
      {showSkeleton ? (
        <NotesPanelSkeleton />
      ) : (
        <NotesTabsPanel
          analystRows={analystNotesRows}
          mainLeadRows={mainLeadNotesRows}
          users={users}
        />
      )}
    </div>
  );
}
