"use client";

import { useMemo, useState } from "react";
import NotesTabsPanel from "@/components/notes/NotesTabsPanel";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { BusyLabel } from "@/components/ui/BusySpinner";
import { Plus, StickyNote } from "lucide-react";
import { LeadNotesPageSkeleton } from "@/components/ui/WorkspaceSkeletons";
import {
  patchChatRecord,
  postChatRecord,
  deleteChatRecord,
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
import { AMOUNT_TO_PAY_MAX_LEN, normalizeAmountToPay } from "@/lib/records/amount";
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
  const [amountToPay, setAmountToPay] = useState("");
  const [requiredDocuments, setRequiredDocuments] = useState("");
  const [classSessionDate, setClassSessionDate] = useState("");
  const [classSessionTime, setClassSessionTime] = useState("");
  const [classSessionInstructions, setClassSessionInstructions] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  const confirmDeleteNote = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      if (deleteTarget.isLeadNoteOnly) {
        await deleteChatRecord(deleteTarget.id);
      } else {
        await patchChatRecord({
          ...deleteTarget,
          leadNote: "",
          leadNoteUpdatedAt: null,
          leadNoteUpdatedBy: null,
          amountToPay: "",
          requiredDocuments: "",
          classSessionDate: "",
          classSessionTime: "",
          classSessionInstructions: "",
        });
      }
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete note.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const addMainTeamLeadNote = async () => {
    if (!user) return;
    const trimmedClientName = clientName.trim();
    const trimmedClientPhone = clientPhone.trim();
    const trimmedNote = note.trim();
    const trimmedProfilePick = profilePick.trim();
    const trimmedAmount = normalizeAmountToPay(amountToPay);
    const trimmedRequiredDocuments = requiredDocuments.trim();
    const trimmedClassSessionDate = classSessionDate.trim();
    const trimmedClassSessionTime = classSessionTime.trim();
    const trimmedClassSessionInstructions = classSessionInstructions.trim();

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
      const nowIso = new Date().toISOString();
      const byEmail = user.email || "main-team-lead";
      const matchingCandidates = matchRecordsForMainLeadNote(baseList, {
        team,
        profilePick: trimmedProfilePick,
        clientName: trimmedClientName,
        clientPhone: trimmedClientPhone,
      });
      const matching = matchingCandidates.filter((record) => {
        if (!(record.leadNote || "").trim()) return true;
        return (record.leadNoteUpdatedBy || "").trim().toLowerCase() === byEmail.toLowerCase();
      });

      if (matching.length) {
        await Promise.all(
          matching.map((r) =>
            patchChatRecord({
              ...r,
              leadNote: trimmedNote,
              leadNoteUpdatedAt: nowIso,
              leadNoteUpdatedBy: byEmail,
              amountToPay: trimmedAmount || r.amountToPay || "",
              requiredDocuments: trimmedRequiredDocuments || r.requiredDocuments || "",
              classSessionDate: trimmedClassSessionDate || r.classSessionDate || "",
              classSessionTime: trimmedClassSessionTime || r.classSessionTime || "",
              classSessionInstructions:
                trimmedClassSessionInstructions || r.classSessionInstructions || "",
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
          amountToPay: trimmedAmount,
          requiredDocuments: trimmedRequiredDocuments,
          classSessionDate: trimmedClassSessionDate,
          classSessionTime: trimmedClassSessionTime,
          classSessionInstructions: trimmedClassSessionInstructions,
          leadNote: trimmedNote,
          leadNoteUpdatedAt: nowIso,
          leadNoteUpdatedBy: byEmail,
          firstReceive: "",
          firstReply: "",
          clientLastReply: "",
          analystLastReply: "",
          firstChatScreenshot: "",
          lastChatScreenshot: "",
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
      setAmountToPay("");
      setRequiredDocuments("");
      setClassSessionDate("");
      setClassSessionTime("");
      setClassSessionInstructions("");
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
        <div className="ct-lead-note-form-head">
          <div className="ct-lead-note-form-heading">
            <span className="ct-lead-note-form-mark" aria-hidden>
              <StickyNote size={19} strokeWidth={2} />
            </span>
            <div>
              <div className="ct-section-title">Add Note For Chat Analyst</div>
              <p className="ct-lead-note-form-copy">Client details and follow-up</p>
            </div>
          </div>
          <span className="ct-lead-note-form-tag">TEAM LEAD</span>
        </div>
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
            <div className="ct-field-label">Amount to be paid</div>
            <input
              className="ct-input"
              value={amountToPay}
              onChange={(e) => setAmountToPay(e.target.value)}
              maxLength={AMOUNT_TO_PAY_MAX_LEN}
              placeholder="e.g. Rs. 50,000"
              inputMode="decimal"
            />
          </div>
          <div className="ct-filter-field ct-lead-note-field--full">
            <div className="ct-field-label">Note</div>
            <textarea
              className="ct-input ct-lead-note-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter note for this client"
            />
          </div>
          <div className="ct-lead-note-section-title">
            <span>Client follow-up</span>
            <span className="ct-lead-note-section-caption">Documents and class session</span>
          </div>
          <div className="ct-filter-field ct-lead-note-field--full">
            <div className="ct-field-label">Required documents</div>
            <textarea
              className="ct-input ct-lead-note-textarea"
              value={requiredDocuments}
              onChange={(e) => setRequiredDocuments(e.target.value)}
              maxLength={1000}
              placeholder="List documents the client needs to provide"
            />
          </div>
          <div className="ct-filter-field">
            <div className="ct-field-label">Session date</div>
            <input
              type="date"
              className="ct-input"
              value={classSessionDate}
              onChange={(e) => setClassSessionDate(e.target.value)}
            />
          </div>
          <div className="ct-filter-field">
            <div className="ct-field-label">Session time</div>
            <input
              type="time"
              className="ct-input"
              value={classSessionTime}
              onChange={(e) => setClassSessionTime(e.target.value)}
            />
          </div>
          <div className="ct-filter-field ct-lead-note-field--full">
            <div className="ct-field-label">Session instructions</div>
            <textarea
              className="ct-input ct-lead-note-textarea"
              value={classSessionInstructions}
              onChange={(e) => setClassSessionInstructions(e.target.value)}
              maxLength={1000}
              placeholder="Optional details or instructions for the client"
            />
          </div>
          <div className="ct-lead-note-actions">
            <button
              type="button"
              className="ct-btn-primary ct-lead-note-submit"
              onClick={() => void addMainTeamLeadNote()}
              disabled={saving}
              aria-busy={saving || undefined}
            >
              {saving ? (
                <BusyLabel label="Saving note…" />
              ) : (
                <>
                  <Plus size={16} strokeWidth={2.2} aria-hidden />
                  Add Note
                </>
              )}
            </button>
          </div>
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
        currentUserEmail={user.email || ""}
        onDeleteMainLeadNote={(record) => {
          setDeleteError("");
          setDeleteTarget(record);
        }}
        deletingRecordId={deleteBusy ? deleteTarget?.id : null}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this note?"
        confirmLabel="Delete note"
        cancelLabel="Keep note"
        danger
        busy={deleteBusy}
        busyLabel="Deleting…"
        error={deleteError}
        onCancel={() => {
          if (!deleteBusy) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
        onConfirm={() => void confirmDeleteNote()}
        titleId="ct-lead-note-delete-title"
      >
        {deleteTarget?.isLeadNoteOnly
          ? "This removes the note and its standalone row. This action cannot be undone."
          : "This removes your note and its follow-up details. The chat record itself will remain."}
      </ConfirmDialog>
    </div>
  );
}
