"use client";

import { useMemo, useState } from "react";
import NotesTabsPanel from "@/components/notes/NotesTabsPanel";
import { BusyLabel } from "@/components/ui/BusySpinner";
import { LeadNotesPageSkeleton } from "@/components/ui/WorkspaceSkeletons";
import {
  patchChatRecord,
  postChatRecord,
  refreshWorkspaceAfterMutation,
} from "@/lib/api/mutations";
import { filterRecordsForViewer } from "@/lib/auth/scoping";
import {
  buildMainLeadMemberProfilesCatalog,
  filterMainLeadNotesRows,
  matchRecordsForMainLeadNote,
} from "@/lib/notes/helpers";
import {
  getPrimaryUserTeam,
  recordCreatorLabel,
  todayIso,
} from "@/lib/records/form-utils";
import type { ChatRecord } from "@/lib/db/records";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useFilteredRecords } from "@/hooks/useFilteredRecords";
import { useWorkspaceHydration } from "@/hooks/useWorkspaceHydration";

export default function LeadNotesView() {
  const user = useAuthStore((s) => s.user);
  const records = useWorkspaceStore((s) => s.records);
  const users = useWorkspaceStore((s) => s.users);
  const { showSkeleton } = useWorkspaceHydration();

  const [profilePick, setProfilePick] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const visibleRecords = useMemo(
    () => filterRecordsForViewer(user!, records) as ChatRecord[],
    [user, records],
  );

  const filteredRecords = useFilteredRecords(visibleRecords);

  const profileCatalog = useMemo(
    () => (user ? buildMainLeadMemberProfilesCatalog(user, users) : []),
    [user, users],
  );

  const mainLeadNotesRows = useMemo(
    () => filterMainLeadNotesRows(filteredRecords, ""),
    [filteredRecords],
  );

  const addMainTeamLeadNote = async () => {
    if (!user) return;
    const trimmedClientName = clientName.trim();
    const trimmedClientPhone = clientPhone.trim();
    const trimmedNote = note.trim();
    const trimmedProfilePick = profilePick.trim();

    if (!trimmedNote) {
      setError("Note text is required.");
      return;
    }
    if (!trimmedClientName && !trimmedClientPhone && !trimmedProfilePick) {
      setError(
        "Select a profile from the dropdown and/or enter client name or client number.",
      );
      return;
    }

    const team = getPrimaryUserTeam(user);
    setSaving(true);
    setError("");

    try {
      const synced = await refreshWorkspaceAfterMutation();
      if (!synced) {
        setError("Could not sync before save.");
        return;
      }

      const baseList = useWorkspaceStore.getState().records;
      const matching = matchRecordsForMainLeadNote(baseList, {
        team,
        profilePick: trimmedProfilePick,
        clientName: trimmedClientName,
        clientPhone: trimmedClientPhone,
      });

      const nowIso = new Date().toISOString();
      const byEmail = user.email || "main-team-lead";

      if (matching.length) {
        await Promise.all(
          matching.map((r) =>
            patchChatRecord({
              ...r,
              leadNote: trimmedNote,
              leadNoteUpdatedAt: nowIso,
              leadNoteUpdatedBy: byEmail,
            }),
          ),
        );
      } else {
        const profileStored = trimmedProfilePick || trimmedClientName;
        const clientNameStored = trimmedProfilePick ? trimmedClientName : "";
        await postChatRecord({
          date: todayIso(),
          analyst: "",
          team,
          profile: profileStored,
          clientName: clientNameStored,
          phone: trimmedClientPhone,
          note: "",
          leadNote: trimmedNote,
          leadNoteUpdatedAt: nowIso,
          leadNoteUpdatedBy: byEmail,
          firstReceive: "",
          firstReply: "",
          clientLastReply: "",
          analystLastReply: "",
          received: 0,
          attempted: 0,
          resolved: 0,
          replyDiff: null,
          totalConv: null,
          noteUpdatedAt: null,
          noteUpdatedBy: null,
          isLeadNoteOnly: true,
          createdBy:
            recordCreatorLabel(user) ||
            (user.email || "").trim() ||
            "main-team-lead",
        });
      }

      setClientName("");
      setClientPhone("");
      setProfilePick("");
      setNote("");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save note.");
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== "mainTeamLead") return null;

  if (showSkeleton) {
    return <LeadNotesPageSkeleton />;
  }

  const profileSelectValue = profileCatalog.some((n) => n === profilePick)
    ? profilePick
    : "";

  return (
    <div className="ct-lead-notes-page">
      <div className="ct-card ct-lead-note-form-card" aria-busy={saving || undefined} style={{ position: "relative" }}>
        {saving ? (
          <div className="ct-dialog-busy-overlay" aria-hidden>
            <span className="ct-dialog-busy-overlay__pill">
              <BusyLabel label="Saving note…" />
            </span>
          </div>
        ) : null}
        <div className="ct-section-title">Add Note For Chat Analyst</div>
        <p className="ct-lead-note-form-copy">
          Add note for a client in your team. This will be visible to Chat Analyst
          Team Lead and Chat Analyst. You can pick a catalog profile from teammates
          on your teams (optional) and/or use client name or number — matching and
          new rows use the same chat record fields as before.
        </p>
        <div className="ct-lead-note-form-grid">
          <div className="ct-filter-field">
            <div className="ct-field-label">Profile (from team members)</div>
            <select
              aria-label="Catalog profile assigned to teammates on your teams"
              className="ct-input ct-select"
              value={profileSelectValue}
              onChange={(e) => setProfilePick(e.target.value)}
            >
              <option value="">
                {profileCatalog.length
                  ? "— Optional profile —"
                  : "— No profiles on your teams yet —"}
              </option>
              {profileCatalog.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="ct-filter-field">
            <div className="ct-field-label">Client name</div>
            <input
              className="ct-input"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Optional if profile / phone given"
            />
          </div>
          <div className="ct-filter-field">
            <div className="ct-field-label">Client number</div>
            <input
              className="ct-input"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="ct-filter-field">
            <div className="ct-field-label">Note</div>
            <textarea
              className="ct-input ct-lead-note-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter note for this client"
            />
          </div>
          <button
            type="button"
            className="ct-btn-primary ct-lead-note-submit"
            onClick={() => void addMainTeamLeadNote()}
            disabled={saving}
            aria-busy={saving || undefined}
          >
            {saving ? <BusyLabel label="Saving note…" /> : "Add Note"}
          </button>
        </div>
        {saved ? <div className="ct-form-success">Note added.</div> : null}
        {error ? <div className="ct-field-error">{error}</div> : null}
      </div>

      <NotesTabsPanel
        analystRows={[]}
        mainLeadRows={mainLeadNotesRows}
        users={users}
        lockView="mainLead"
        panelTitle="Important Notes"
        mainLeadEmptyMessage="No main team lead notes added yet."
      />
    </div>
  );
}
