"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  MessageSquareText,
  StickyNote,
  Tag,
  X,
} from "lucide-react";
import AnalystAvatarCell from "@/components/notes/AnalystAvatarCell";
import AnalystNotesPaginationBar from "@/components/notes/AnalystNotesPaginationBar";
import {
  ANALYST_NOTES_PAGE_SIZE,
  paginateRows,
} from "@/lib/notes/helpers";
import { teamColorFor } from "@/lib/design/colors";
import { btn, card } from "@/lib/design/control-styles";
import { displayClient } from "@/lib/records/form-utils";
import type { ChatRecord } from "@/lib/db/records";
import type { WorkspaceUser } from "@/lib/workspace/cache";

type NotesPanelView = "analyst" | "mainLead";

const NOTE_PREVIEW_LEN = 96;

function TeamBadge({ team }: { team: string }) {
  const label = team || "—";
  const tint = teamColorFor(team);
  return (
    <span
      className="ct-notes-team-pill"
      style={{
        borderColor: `${tint}44`,
        background: `linear-gradient(165deg, ${tint}22 0%, ${tint}0d 100%)`,
        color: tint,
      }}
    >
      <span className="ct-notes-team-pill__dot" style={{ background: tint }} aria-hidden />
      {label}
    </span>
  );
}

function ProfilePill({ profile }: { profile: string }) {
  const label = (profile || "").trim();
  if (!label) return <span className="ct-notes-table__muted">—</span>;
  return (
    <span className="ct-notes-profile-pill">
      <Tag size={11} strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}

function NotePreviewCell({
  text,
  contextLabel,
  onExpand,
}: {
  text: string;
  contextLabel: string;
  onExpand: (payload: { title: string; body: string }) => void;
}) {
  const body = (text || "").trim();
  if (!body) return <span className="ct-notes-table__muted">—</span>;

  const preview =
    body.length > NOTE_PREVIEW_LEN ? `${body.slice(0, NOTE_PREVIEW_LEN).trim()}…` : body;
  const expandable = body.length > NOTE_PREVIEW_LEN;

  return (
    <button
      type="button"
      className="ct-notes-note-row"
      onClick={() => onExpand({ title: contextLabel, body })}
      aria-label={expandable ? `Read full note for ${contextLabel}` : `Note for ${contextLabel}`}
      title={body}
    >
      <MessageSquareText size={13} strokeWidth={2} aria-hidden className="ct-notes-note-row__icon" />
      <span className="ct-notes-note-row__text">{preview}</span>
      {expandable ? (
        <ChevronRight size={14} strokeWidth={2.25} aria-hidden className="ct-notes-note-row__chev" />
      ) : null}
    </button>
  );
}

function NoteDetailModal({
  open,
  title,
  body,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
}) {
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      className="ct-admin-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ct-notes-detail-modal-title"
        className="ct-notes-detail-modal"
        style={card({
          padding: 0,
          maxWidth: 560,
          width: "100%",
          maxHeight: "min(88vh, 520px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
        })}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ct-notes-detail-modal__head">
          <div className="ct-notes-detail-modal__head-text">
            <span className="ct-notes-detail-modal__icon" aria-hidden>
              <StickyNote size={18} strokeWidth={2.1} />
            </span>
            <div>
              <h2 id="ct-notes-detail-modal-title" className="ct-notes-detail-modal__title">
                Note details
              </h2>
              <p className="ct-notes-detail-modal__subtitle">{title}</p>
            </div>
          </div>
          <button type="button" className="ct-catalog-modal__close" aria-label="Close" onClick={close}>
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="ct-notes-detail-modal__body">{body}</div>
        <div className="ct-notes-detail-modal__foot">
          <button type="button" {...btn("ghost", { padding: "9px 18px" })} onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function NotesTabsPanel({
  analystRows,
  mainLeadRows,
  users,
  analystEmptyMessage = "No analyst notes in the current filter set.",
  mainLeadEmptyMessage = "No main team lead notes added yet.",
  paginationNavLabel = "Chat Analyst Notes pagination",
  profileFilterSlot,
  profileFilterKey = "",
  lockView,
  panelTitle,
}: {
  analystRows: ChatRecord[];
  mainLeadRows: ChatRecord[];
  users: WorkspaceUser[];
  analystEmptyMessage?: string;
  mainLeadEmptyMessage?: string;
  paginationNavLabel?: string;
  profileFilterSlot?: React.ReactNode;
  profileFilterKey?: string;
  /** When set, hides tabs and always shows this view. */
  lockView?: NotesPanelView;
  /** Optional heading when `lockView` is set (e.g. Important Notes). */
  panelTitle?: string;
}) {
  const [notesPanelView, setNotesPanelView] = useState<NotesPanelView>(
    lockView ?? "analyst",
  );
  const [analystNotesPage, setAnalystNotesPage] = useState(0);
  const [noteDetail, setNoteDetail] = useState<{ title: string; body: string } | null>(null);

  const activeView = lockView ?? notesPanelView;

  const pagination = useMemo(
    () => paginateRows(analystRows, analystNotesPage, ANALYST_NOTES_PAGE_SIZE),
    [analystRows, analystNotesPage],
  );

  const displayRows =
    activeView === "analyst" ? pagination.slice : mainLeadRows;

  useEffect(() => {
    setAnalystNotesPage(0);
  }, [analystRows.length, profileFilterKey]);

  const tabs = [
    { id: "analyst" as const, label: "Chat Analyst Notes", count: analystRows.length },
    { id: "mainLead" as const, label: "Main Team Lead Notes", count: mainLeadRows.length },
  ];

  function noteContext(r: ChatRecord) {
    return [r.date, r.clientName || displayClient(r), r.analyst].filter(Boolean).join(" · ");
  }

  const showTabs = !lockView;

  return (
    <section
      className={`ct-notes-panel ct-card${lockView ? " ct-notes-panel--locked" : ""}`}
    >
      <div className="ct-notes-toolbar-row">
        {showTabs ? (
          <div className="ct-notes-tabs" role="tablist" aria-label="Notes by source">
            {tabs.map((t) => {
              const active = activeView === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`ct-notes-tab${active ? " ct-notes-tab--active" : ""}`}
                  onClick={() => {
                    setNotesPanelView(t.id);
                    if (t.id === "analyst") setAnalystNotesPage(0);
                  }}
                >
                  {t.label}
                  <span className="ct-notes-tab__count">{t.count}</span>
                </button>
              );
            })}
          </div>
        ) : panelTitle ? (
          <div className="ct-notes-panel__title">{panelTitle}</div>
        ) : null}
        {profileFilterSlot ? (
          <div className="ct-notes-profile-filter">{profileFilterSlot}</div>
        ) : null}
      </div>

      {activeView === "analyst" ? (
        <AnalystNotesPaginationBar
          total={analystRows.length}
          activePage={pagination.activePage}
          totalPages={pagination.totalPages}
          rangeStart={pagination.rangeStart}
          rangeEnd={pagination.rangeEnd}
          onPrev={() => setAnalystNotesPage((p) => Math.max(0, p - 1))}
          onNext={() =>
            setAnalystNotesPage((p) =>
              Math.min(Math.max(pagination.totalPages - 1, 0), p + 1),
            )
          }
          navLabel={paginationNavLabel}
        />
      ) : null}

      <div className="ct-notes-table-scroll">
        <table className="ct-notes-table">
          <colgroup>
            <col className="ct-notes-col ct-notes-col--date" />
            <col className="ct-notes-col ct-notes-col--team" />
            <col className="ct-notes-col ct-notes-col--profile" />
            <col className="ct-notes-col ct-notes-col--client" />
            <col className="ct-notes-col ct-notes-col--analyst" />
            <col className="ct-notes-col ct-notes-col--note" />
          </colgroup>
          <thead>
            <tr>
              <th>Date</th>
              <th>Team</th>
              <th>Profile</th>
              <th>{activeView === "analyst" ? "Client name" : "Client"}</th>
              <th>Analyst</th>
              <th>{activeView === "analyst" ? "Analyst Note" : "Main Lead Note"}</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="ct-notes-table__empty">
                  {activeView === "analyst" ? analystEmptyMessage : mainLeadEmptyMessage}
                </td>
              </tr>
            ) : activeView === "analyst" ? (
              displayRows.map((r) => (
                <tr key={`analyst-note-${r.id}`}>
                  <td className="ct-notes-table__date">{r.date}</td>
                  <td className="ct-notes-table__team">
                    <TeamBadge team={r.team || "—"} />
                  </td>
                  <td className="ct-notes-table__profile">
                    <ProfilePill profile={r.profile || ""} />
                  </td>
                  <td className="ct-notes-table__client">{r.clientName || "—"}</td>
                  <td className="ct-notes-table__analyst">
                    <AnalystAvatarCell analyst={r.analyst || ""} users={users} showName />
                  </td>
                  <td className="ct-notes-table__note">
                    <NotePreviewCell
                      text={r.note || ""}
                      contextLabel={noteContext(r)}
                      onExpand={setNoteDetail}
                    />
                  </td>
                </tr>
              ))
            ) : (
              displayRows.map((r) => (
                <tr key={`main-note-${r.id}`}>
                  <td className="ct-notes-table__date">{r.date}</td>
                  <td className="ct-notes-table__team">
                    <TeamBadge team={r.team || "—"} />
                  </td>
                  <td className="ct-notes-table__profile">
                    <ProfilePill profile={r.profile || ""} />
                  </td>
                  <td className="ct-notes-table__client">{displayClient(r)}</td>
                  <td className="ct-notes-table__analyst">
                    <AnalystAvatarCell analyst={r.analyst || ""} users={users} showName />
                  </td>
                  <td className="ct-notes-table__note">
                    <NotePreviewCell
                      text={r.leadNote || ""}
                      contextLabel={noteContext(r)}
                      onExpand={setNoteDetail}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <NoteDetailModal
        open={Boolean(noteDetail)}
        title={noteDetail?.title || ""}
        body={noteDetail?.body || ""}
        onClose={() => setNoteDetail(null)}
      />
    </section>
  );
}
