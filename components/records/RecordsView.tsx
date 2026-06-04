"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C, RAD, SANS, TYPE } from "@/lib/design/tokens";
import { teamColorFor } from "@/lib/design/colors";
import { deleteChatRecord, patchChatRecord } from "@/lib/api/mutations";
import {
  buildChatRecordFromForm,
  cascadeRecordDateChange,
  computeReplyDiffMins,
  computeTotalConvMins,
  getLogChatTimeFieldErrors,
  isValidRecordTime,
  logFormFromChatRecord,
  outcomesRespectOrdering,
  validateRecordTimeOrdering,
} from "@/lib/records/form-utils";
import { fmtMins, replyDiffFromRecord, totalConvFromRecord } from "@/lib/utils/format-duration";
import { formatStoredTimeDisplay } from "@/lib/utils/time-input";
import { badgeStyle, btnStyle, cardStyle, inputStyle } from "@/lib/styles/controls";
import { BusyLabel } from "@/components/ui/BusySpinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { displayClient } from "@/lib/records/form-utils";
import type { ChatRecord } from "@/lib/db/records";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useFilteredRecords } from "@/hooks/useFilteredRecords";
import { useEffectiveDashboardFilters } from "@/hooks/useEffectiveDashboardFilters";
import { useWorkspaceHydration } from "@/hooks/useWorkspaceHydration";
import RecordAnalystPeekCell from "@/components/records/RecordAnalystPeekCell";
import RecordsPaginationBar from "@/components/records/RecordsPaginationBar";
import { RecordsTableSkeleton } from "@/components/ui/WorkspaceSkeletons";
import CtCheckbox from "@/components/ui/CtCheckbox";
import CtDateInput from "@/components/ui/CtDateInput";
import LogTimeFieldRow, { LOG_TIME_FIELD_CONFIGS } from "@/components/log/LogTimeFieldRow";
import { useRecordsEditScroll } from "@/hooks/useRecordsEditScroll";

const PAGE_SIZE = 25;

function StatusBadge({ record }: { record: Partial<ChatRecord> }) {
  const hasAnalystLast = !!(String(record.analystLastReply ?? "").trim());
  const hasFirstReply = !!(String(record.firstReply ?? "").trim());
  let text: string;
  let color: string;
  if (hasAnalystLast) {
    text = "Completed";
    color = C.green;
  } else if (!hasFirstReply) {
    text = "Awaiting reply";
    color = C.red;
  } else {
    text = "Ongoing";
    color = C.orange;
  }
  return <span style={badgeStyle(color)}>{text}</span>;
}

function TeamBadge({ team }: { team: string }) {
  return <span style={badgeStyle(teamColorFor(team), team)}>{team}</span>;
}

const LEDGER_HEADERS: { label: string; className?: string }[] = [
  { label: "Date", className: "ct-records-table__col-date" },
  { label: "Analyst", className: "ct-records-table__col-analyst" },
  { label: "Team" },
  { label: "Profile", className: "ct-records-table__col-profile" },
  { label: "Client name", className: "ct-records-table__col-client" },
  { label: "Phone", className: "ct-records-table__col-phone" },
  { label: "1st Receive", className: "ct-records-table__col-time" },
  { label: "1st Reply", className: "ct-records-table__col-time" },
  { label: "Reply diff", className: "ct-records-table__col-metric" },
  { label: "Client last", className: "ct-records-table__col-time" },
  { label: "Analyst last", className: "ct-records-table__col-time" },
  { label: "Total conv", className: "ct-records-table__col-metric" },
  { label: "Status", className: "ct-records-table__col-status" },
  { label: "R / A / S", className: "ct-records-table__col-ras" },
  { label: "Actions", className: "ct-records-table__col-actions" },
];

function LedgerTextCell({ value }: { value: string }) {
  const label = (value || "—").trim() || "—";
  return (
    <span className="ct-records-table__text" title={label !== "—" ? label : undefined}>
      {label}
    </span>
  );
}

export default function RecordsView() {
  const user = useAuthStore((s) => s.user);
  const records = useWorkspaceStore((s) => s.records);
  const users = useWorkspaceStore((s) => s.users);
  const { showSkeleton } = useWorkspaceHydration();
  const effectiveFilters = useEffectiveDashboardFilters();

  const [page, setPage] = useState(0);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ChatRecord | null>(null);
  const [editUseFirstReplyAsLast, setEditUseFirstReplyAsLast] = useState(false);
  const [editError, setEditError] = useState("");
  const [editFormEpoch, setEditFormEpoch] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const scrollAnchorRef = useRef<number | null>(null);

  const role = user?.role ?? "analyst";
  const canDeleteRecords = role === "teamLead";
  const canUpdateRecords = role === "teamLead" || role === "analyst";

  const filtered = useFilteredRecords(records);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const activePage = Math.min(page, Math.max(totalPages - 1, 0));
  const pageRecords = sorted.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const pageStart = filtered.length === 0 ? 0 : activePage * PAGE_SIZE + 1;
  const pageEnd =
    filtered.length === 0 ? 0 : Math.min(filtered.length, (activePage + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [effectiveFilters]);

  const findRecordPage = useCallback(
    (recordId: number) => {
      const idx = sorted.findIndex((r) => r.id === recordId);
      if (idx < 0) return null;
      return Math.floor(idx / PAGE_SIZE);
    },
    [sorted],
  );

  const {
    editPanelRef,
    highlightRecordId,
    notifyEditOpened,
    notifyEditClosed,
  } = useRecordsEditScroll({
    editOpen: !!editForm,
    page: activePage,
    setPage,
    findRecordPage,
  });

  const closeEditWithReturnScroll = useCallback(() => {
    const anchor = scrollAnchorRef.current;
    scrollAnchorRef.current = null;
    if (anchor != null) notifyEditClosed(anchor);
    setEditId(null);
    setEditForm(null);
    setEditError("");
  }, [notifyEditClosed]);

  const editPreviewAnalystLast =
    editForm && !editForm.clientLastReply && editUseFirstReplyAsLast
      ? editForm.firstReply
      : editForm?.analystLastReply ?? "";
  const editPreviewAnalystLastDate =
    editForm && !editForm.clientLastReply && editUseFirstReplyAsLast
      ? editForm.firstReplyDate
      : editForm?.analystLastReplyDate ?? "";
  const editPreviewReplyDiff = editForm ? computeReplyDiffMins(editForm) : null;
  const editPreviewTotalConv = editForm
    ? computeTotalConvMins(editForm, editPreviewAnalystLast, editPreviewAnalystLastDate)
    : null;

  const editTimeFieldErrors = useMemo(
    () =>
      editForm
        ? getLogChatTimeFieldErrors(editForm, editUseFirstReplyAsLast)
        : {},
    [editForm, editUseFirstReplyAsLast],
  );
  const hasEditTimeOrderError = Object.keys(editTimeFieldErrors).length > 0;

  const setEditF = <K extends keyof ChatRecord>(key: K, value: ChatRecord[K]) => {
    const base = editForm || ({} as ChatRecord);
    setEditForm({ ...base, [key]: value });
    if (editError) setEditError("");
  };

  const openEdit = (record: ChatRecord) => {
    scrollAnchorRef.current = record.id;
    notifyEditOpened();
    setEditId(record.id);
    setEditForm({ ...record, ...logFormFromChatRecord(record) });
    setEditUseFirstReplyAsLast(false);
    setEditError("");
    setEditFormEpoch((n) => n + 1);
  };

  const cancelEdit = () => {
    closeEditWithReturnScroll();
  };

  const saveEdit = async () => {
    if (!editForm || editId == null || !user) return;

    const normalizedEditForm: ChatRecord = {
      ...editForm,
      analystLastReply:
        !editForm.clientLastReply && editUseFirstReplyAsLast
          ? editForm.firstReply
          : editForm.analystLastReply,
    };

    if (
      !normalizedEditForm.analyst ||
      !normalizedEditForm.team ||
      !normalizedEditForm.date ||
      !normalizedEditForm.firstReceive
    ) {
      setEditError("Date, Analyst, Team and 1st Chat Receive are required.");
      return;
    }
    if (!outcomesRespectOrdering(normalizedEditForm)) {
      setEditError("Chat outcomes must follow Received >= Attempted >= Resolved (0 or 1).");
      return;
    }
    const timeOrder = validateRecordTimeOrdering(normalizedEditForm);
    if (!timeOrder.ok) {
      setEditError(timeOrder.message || "Invalid time ordering.");
      return;
    }
    const timesOk = [
      normalizedEditForm.firstReceive,
      normalizedEditForm.firstReply,
      normalizedEditForm.clientLastReply,
      normalizedEditForm.analystLastReply,
    ].every(isValidRecordTime);
    if (!timesOk) {
      setEditError("Enter a valid time for each filled field (use AM/PM or 24-hour).");
      return;
    }

    const existing = records.find((r) => r.id === editId);
    if (!existing) {
      setEditError("Record no longer exists. Try refreshing.");
      return;
    }

    const noteChanged = (existing.note || "") !== (normalizedEditForm.note || "");
    const built = buildChatRecordFromForm(
      logFormFromChatRecord(normalizedEditForm),
      user,
      editUseFirstReplyAsLast,
    );
    const updatedRecord: ChatRecord = {
      ...normalizedEditForm,
      ...built,
      id: editId,
      noteUpdatedAt:
        noteChanged && (normalizedEditForm.note || "").trim()
          ? new Date().toISOString()
          : existing.noteUpdatedAt,
      noteUpdatedBy:
        noteChanged && (normalizedEditForm.note || "").trim()
          ? user.email
          : existing.noteUpdatedBy,
      createdBy: (existing.createdBy || "").trim() || normalizedEditForm.createdBy || "",
    };

    setSaving(true);
    setEditError("");
    try {
      await patchChatRecord(updatedRecord);
      closeEditWithReturnScroll();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (record: ChatRecord) => {
    setDeleteError("");
    setDeleteTarget(record);
  };

  const closeDeleteDialog = () => {
    if (deleteBusy) return;
    setDeleteTarget(null);
    setDeleteError("");
  };

  const confirmDeleteRecord = async () => {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      await deleteChatRecord(deleteTarget.id);
      if (editId === deleteTarget.id) cancelEdit();
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete record.");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (!user) return null;

  if (showSkeleton) {
    return <RecordsTableSkeleton />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {editForm && (
        <div
          ref={editPanelRef}
          style={cardStyle({ padding: 0, marginBottom: 0, overflow: "hidden", borderRadius: RAD.lg, position: "relative" })}
          aria-busy={saving || undefined}
        >
          {saving ? (
            <div className="ct-dialog-busy-overlay" aria-hidden>
              <span className="ct-dialog-busy-overlay__pill">
                <BusyLabel label="Saving update…" />
              </span>
            </div>
          ) : null}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: `1px solid ${C.dim}`,
              background: `linear-gradient(180deg, #fbfdff 0%, ${C.surface} 100%)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 3,
                  alignSelf: "stretch",
                  minHeight: 44,
                  borderRadius: 99,
                  background: C.accent,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: C.muted,
                  }}
                >
                  Update chat record
                </div>
                <div
                  style={{
                    color: C.label,
                    fontSize: 13,
                    marginTop: 4,
                    fontFamily: SANS,
                    lineHeight: 1.45,
                  }}
                >
                  Adjust times and note. Use the hour / minute / AM·PM pickers — same as Log Chat.
                  Only 1st Chat Receive is required; reply fields can stay blank until updated.
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: "18px 22px 20px", fontFamily: SANS }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 14,
                marginBottom: 14,
              }}
            >
              <CtDateInput
                key={editForm.date || "__empty__"}
                value={editForm.date || ""}
                onChange={(v) =>
                  setEditForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          ...cascadeRecordDateChange(logFormFromChatRecord(prev), v),
                        }
                      : prev,
                  )
                }
              />
              <input
                style={inputStyle()}
                value={editForm.analyst}
                onChange={(e) => setEditF("analyst", e.target.value)}
                placeholder="Chat Analyst"
              />
              <input
                style={inputStyle()}
                value={editForm.team}
                onChange={(e) => setEditF("team", e.target.value)}
                placeholder="Team"
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <textarea
                style={inputStyle({ minHeight: 72, resize: "vertical", fontFamily: SANS })}
                placeholder="Important lead note"
                value={editForm.note || ""}
                onChange={(e) => setEditF("note", e.target.value)}
              />
            </div>
            <section
              className="ct-log-time-panel"
              aria-labelledby="records-edit-time-heading"
              style={{ marginBottom: 14 }}
            >
              <header className="ct-log-time-panel__head">
                <h3 id="records-edit-time-heading" className="ct-log-time-panel__title">
                  Time tracking
                </h3>
                <p className="ct-log-time-panel__hint">
                  Use the calendar icon when a reply was on a different day. Pick hour, minute, and
                  AM/PM for each field. Leave reply times blank until known.
                </p>
              </header>

              <div className="ct-log-time-board">
                {LOG_TIME_FIELD_CONFIGS.map((config) => {
                  const fieldError = editTimeFieldErrors[config.timeKey];
                  const dateKey = config.dateKey;
                  const timeKey = config.timeKey;
                  return (
                    <LogTimeFieldRow
                      key={timeKey}
                      config={config}
                      idPrefix="records-edit"
                      recordDate={editForm.date}
                      dateValue={editForm[dateKey]}
                      timeValue={editForm[timeKey]}
                      onDateChange={(v) => {
                        setEditForm((prev) => {
                          if (!prev) return prev;
                          const base = logFormFromChatRecord(prev);
                          const next = { ...prev, ...base, [dateKey]: v };
                          if (timeKey === "firstReceive") {
                            const cascaded = cascadeRecordDateChange(
                              { ...base, ...next, date: v },
                              v,
                            );
                            return { ...next, ...cascaded };
                          }
                          return next;
                        });
                      }}
                      onTimeChange={(v) => setEditF(timeKey, v)}
                      fieldError={fieldError}
                      formEpoch={editFormEpoch}
                    />
                  );
                })}
              </div>

              <div className="ct-log-time-footer">
                <CtCheckbox
                  checked={editUseFirstReplyAsLast}
                  onChange={setEditUseFirstReplyAsLast}
                  disabled={!!editForm.clientLastReply}
                >
                  Use 1st reply as analyst last reply when client last reply is missing
                </CtCheckbox>

                {(editPreviewReplyDiff != null || editPreviewTotalConv != null) && (
                  <dl className="ct-log-time-metrics">
                    {editPreviewReplyDiff != null && (
                      <div className="ct-log-time-metric ct-log-time-metric--reply-diff">
                        <dt className="ct-log-time-metric__label">Reply difference</dt>
                        <dd className="ct-log-time-metric__value">
                          {fmtMins(editPreviewReplyDiff)}
                        </dd>
                      </div>
                    )}
                    {editPreviewTotalConv != null && (
                      <div className="ct-log-time-metric">
                        <dt className="ct-log-time-metric__label">Total conversation</dt>
                        <dd className="ct-log-time-metric__value">
                          {fmtMins(editPreviewTotalConv)}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            </section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                style={btnStyle("primary", { padding: "10px 18px" })}
                onClick={saveEdit}
                disabled={saving || hasEditTimeOrderError}
                aria-busy={saving || undefined}
              >
                {saving ? <BusyLabel label="Saving…" /> : "Save update"}
              </button>
              <button
                type="button"
                style={btnStyle("ghost", { padding: "10px 18px" })}
                onClick={cancelEdit}
              >
                Cancel
              </button>
            </div>
            {editError && (
              <div style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{editError}</div>
            )}
          </div>
        </div>
      )}

      <section className="ct-records-ledger ct-card">
        <div className="ct-records-ledger__head">
          <div className="ct-records-ledger__head-row">
            <div className="ct-records-ledger__head-main">
              <span className="ct-records-ledger__title">Chat ledger</span>
              <span className="ct-records-ledger__count">
                {filtered.length.toLocaleString()} records
              </span>
              <span className="ct-records-ledger__hint">
                Scroll horizontally on smaller screens
              </span>
            </div>
          </div>
          <RecordsPaginationBar
            total={filtered.length}
            activePage={activePage}
            totalPages={totalPages}
            rangeStart={pageStart}
            rangeEnd={pageEnd}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          />
        </div>

        <div className="ct-records-table-scroll">
          <table className="ct-records-table">
            <thead>
              <tr>
                {LEDGER_HEADERS.map(({ label, className }) => (
                  <th key={label} className={className}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRecords.length === 0 ? (
                <tr>
                  <td colSpan={15} className="ct-records-table__empty">
                    <div style={{ ...TYPE.caption, fontWeight: 500 }}>
                      No records match the current filters.
                    </div>
                    <div className="ct-records-table__empty-sub">
                      Relax a filter or reset the filter bar to see more rows.
                    </div>
                  </td>
                </tr>
              ) : (
                pageRecords.map((r) => (
                  <tr
                    key={r.id}
                    id={`ct-record-row-${r.id}`}
                    className={
                      highlightRecordId === r.id ? "ct-records-table__row--highlight" : undefined
                    }
                  >
                    <td className="ct-records-table__col-date">{r.date}</td>
                    <td className="ct-records-table__col-analyst">
                      <RecordAnalystPeekCell analyst={r.analyst || ""} users={users} />
                    </td>
                    <td>
                      <TeamBadge team={r.team} />
                    </td>
                    <td className="ct-records-table__col-profile">
                      <LedgerTextCell value={r.profile || ""} />
                    </td>
                    <td className="ct-records-table__col-client">
                      <LedgerTextCell value={r.clientName || ""} />
                    </td>
                    <td className="ct-records-table__col-phone">
                      <LedgerTextCell value={r.phone || ""} />
                    </td>
                    <td className="ct-records-table__col-time">
                      {formatStoredTimeDisplay(r.firstReceive) || "—"}
                    </td>
                    <td className="ct-records-table__col-time">
                      {formatStoredTimeDisplay(r.firstReply) || "—"}
                    </td>
                    <td className="ct-records-table__col-metric ct-records-table__metric-accent">
                      {fmtMins(replyDiffFromRecord(r))}
                    </td>
                    <td className="ct-records-table__col-time">
                      {formatStoredTimeDisplay(r.clientLastReply) || "—"}
                    </td>
                    <td className="ct-records-table__col-time">
                      {formatStoredTimeDisplay(r.analystLastReply) || "—"}
                    </td>
                    <td className="ct-records-table__col-metric ct-records-table__metric-warn">
                      {fmtMins(totalConvFromRecord(r))}
                    </td>
                    <td className="ct-records-table__col-status">
                      <StatusBadge record={r} />
                    </td>
                    <td className="ct-records-table__col-ras ct-records-table__ras">
                      <span>{r.received}</span>
                      <span className="ct-records-table__ras-sep"> / </span>
                      <span>{r.attempted}</span>
                      <span className="ct-records-table__ras-sep"> / </span>
                      <span>{r.resolved}</span>
                    </td>
                    <td className="ct-records-table__col-actions">
                      {canUpdateRecords || canDeleteRecords ? (
                        <div className="ct-records-table__actions">
                          {canUpdateRecords ? (
                            <button
                              type="button"
                              className="ct-records-table__action-btn"
                              onClick={() => openEdit(r)}
                            >
                              Update
                            </button>
                          ) : null}
                          {canDeleteRecords ? (
                            <button
                              type="button"
                              className="ct-records-table__action-btn ct-records-table__action-btn--danger"
                              onClick={() => openDeleteDialog(r)}
                              aria-label={`Delete record ${r.id}`}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove chat record?"
        confirmLabel="Yes, remove"
        cancelLabel="Keep record"
        danger
        busy={deleteBusy}
        busyLabel="Removing…"
        error={deleteError}
        onCancel={closeDeleteDialog}
        onConfirm={() => void confirmDeleteRecord()}
        titleId="ct-records-delete-title"
      >
        {deleteTarget ? (
          <>
            This permanently deletes the ledger row for{" "}
            <span style={{ fontWeight: 600, color: C.text }}>{displayClient(deleteTarget)}</span>
            {deleteTarget.analyst ? (
              <>
                {" "}
                logged by{" "}
                <span style={{ fontWeight: 600, color: C.text }}>{deleteTarget.analyst}</span>
              </>
            ) : null}
            {deleteTarget.date ? (
              <>
                {" "}
                on{" "}
                <span style={{ fontWeight: 600, color: C.text }}>{deleteTarget.date}</span>
              </>
            ) : null}
            . This cannot be undone.
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
