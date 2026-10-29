"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, RotateCcw, Search, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CtSelect from "@/components/ui/CtSelect";
import {
  deleteWhatsAppAudit,
  patchWhatsAppAuditCategory,
} from "@/lib/api/whatsapp-audit-mutations";
import { isUnrestrictedTeamLead } from "@/lib/auth/scoping";
import { matchesActiveRecordFilters } from "@/lib/dashboard/records";
import {
  REPLY_TIMINGS,
  REPLY_TIMING_LABELS,
  normalizeReplyTiming,
  type ReplyTiming,
} from "@/lib/records/reply-timing";
import { auditWeekday, formatAuditDate, type WhatsAppAudit } from "@/lib/whatsapp-audit/types";
import { useAuthStore } from "@/store/auth-store";
import { useEffectiveDashboardFilters } from "@/hooks/useEffectiveDashboardFilters";
import { useWhatsAppAudits } from "@/hooks/useWhatsAppAudits";
import {
  CategoryPicker,
  Dash,
  FILTER_TRIGGER,
  timeOrDash,
  type SaveState,
} from "./audit-ui";

const PAGE_SIZE = 50;
const SKELETON_ROWS = 10;
const ALL = "__all__";
const NOT_SET = "__not_set__";

const COLUMNS: { key: string; label: string; className?: string }[] = [
  { key: "date", label: "Date" },
  { key: "day", label: "Day" },
  { key: "shift", label: "Shift" },
  { key: "team", label: "Team" },
  { key: "profile", label: "Profile Name" },
  { key: "client", label: "Client Name" },
  { key: "received", label: "Client Msg Received", className: "ct-wa-num" },
  { key: "reply", label: "Reply Time", className: "ct-wa-num" },
  { key: "category", label: "Category" },
  { key: "message", label: "Client message" },
];

/** Maps an audit onto the record shape the sidebar's global filters understand. */
function asFilterable(a: WhatsAppAudit) {
  return {
    date: a.date,
    analyst: a.analyst,
    team: a.team,
    profile: a.profile,
    firstReceive: a.clientMsgReceived,
    firstReply: a.replyTime,
    analystLastReply: a.replyTime,
  };
}

/**
 * WhatsApp Audit review page. Reads `public.whatsapp_audits` (entries chat analysts log on
 * /log-whatsapp-audit) — completely separate from chat records.
 */
export default function WhatsAppAuditView() {
  const user = useAuthStore((s) => s.user);
  const allowed = !!user && (user.role === "mainTeamLead" || isUnrestrictedTeamLead(user));
  const { audits, status, error: loadError, schemaMissing } = useWhatsAppAudits(
    allowed ? user?.id : null,
  );
  const filters = useEffectiveDashboardFilters();
  const ready = status === "ready" || (status === "error" && audits.length > 0);
  const canDelete = user?.role === "teamLead";

  const [team, setTeam] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [saveStates, setSaveStates] = useState<Record<number, SaveState>>({});
  const [error, setError] = useState("");
  /** Rows edited under the current filters stay visible until the filters change. */
  const [pinned, setPinned] = useState<Set<number>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState<WhatsAppAudit | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const savedTimers = useRef(new Map<number, number>());

  useEffect(() => {
    const timers = savedTimers.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const auditRows = useMemo(
    () => audits.filter((a) => matchesActiveRecordFilters(asFilterable(a), filters)),
    [audits, filters],
  );

  const teamOptions = useMemo(() => {
    const names = [...new Set(auditRows.map((r) => r.team).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
    return [{ value: ALL, label: "All teams" }, ...names.map((n) => ({ value: n }))];
  }, [auditRows]);

  const categoryFilterOptions = useMemo(
    () => [
      { value: ALL, label: "All categories" },
      ...REPLY_TIMINGS.map((t) => ({ value: t, label: REPLY_TIMING_LABELS[t] })),
      { value: NOT_SET, label: "Not set" },
    ],
    [],
  );

  const teamRows = useMemo(
    () => (team === ALL ? auditRows : auditRows.filter((r) => r.team === team)),
    [auditRows, team],
  );

  const searchedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teamRows;
    return teamRows.filter((r) =>
      [r.clientName, r.profile, r.clientMessage, r.shift, r.team, r.analyst]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q)),
    );
  }, [teamRows, query]);

  const matchesCategory = useCallback(
    (r: WhatsAppAudit) => {
      if (category === ALL) return true;
      const t = normalizeReplyTiming(r.category);
      return category === NOT_SET ? t == null : t === category;
    },
    [category],
  );

  // Store order is audit_date desc, id desc; keep it, newest first.
  const rows = useMemo(
    () => searchedRows.filter((r) => matchesCategory(r) || pinned.has(r.id)),
    [searchedRows, matchesCategory, pinned],
  );

  const stats = useMemo(() => {
    const inCategory = searchedRows.filter(matchesCategory).length;
    const uncategorized = teamRows.filter((r) => !normalizeReplyTiming(r.category)).length;
    return {
      inCategory,
      share: searchedRows.length ? Math.round((inCategory / searchedRows.length) * 100) : 0,
      teamTotal: teamRows.length,
      uncategorized,
    };
  }, [searchedRows, teamRows, matchesCategory]);

  const resetView = (fn: () => void) => {
    fn();
    setPage(0);
    setPinned(new Set());
  };

  const setRowState = (id: number, state: SaveState | null) =>
    setSaveStates((prev) => {
      const next = { ...prev };
      if (state) next[id] = state;
      else delete next[id];
      return next;
    });

  const saveCategory = async (audit: WhatsAppAudit, next: ReplyTiming | null) => {
    if ((normalizeReplyTiming(audit.category) ?? null) === next) return;
    const timer = savedTimers.current.get(audit.id);
    if (timer) window.clearTimeout(timer);
    if (category !== ALL) setPinned((prev) => new Set(prev).add(audit.id));
    setError("");
    setRowState(audit.id, "saving");
    try {
      const saved = await patchWhatsAppAuditCategory(audit.id, next);
      if (saved === null) return; // a newer pick on this row is being saved
      setRowState(audit.id, "saved");
      savedTimers.current.set(
        audit.id,
        window.setTimeout(() => setRowState(audit.id, null), 1400),
      );
    } catch (e) {
      setRowState(audit.id, "error");
      setError(e instanceof Error ? e.message : "Could not save the category. Please try again.");
    }
  };

  const runDelete = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteWhatsAppAudit(confirmDelete.id);
      setConfirmDelete(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete this audit.");
    } finally {
      setDeleting(false);
    }
  };

  if (!user || !allowed) return null;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const activePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const rangeStart = rows.length ? activePage * PAGE_SIZE + 1 : 0;
  const rangeEnd = activePage * PAGE_SIZE + pageRows.length;
  const filtersActive = team !== ALL || category !== ALL || query.trim() !== "";
  const colCount = COLUMNS.length + (canDelete ? 1 : 0);
  const notice = schemaMissing
    ? "WhatsApp Audit is not set up on the database yet. Run supabase/cloud-scripts/whatsapp_audits.sql, then reload."
    : error || (status === "error" ? loadError : "");

  return (
    <div className="ct-wa-page">
      <section className="ct-card ct-wa-card">
        <header className="ct-wa-head">
          <div className="ct-wa-head__title">
            <h2 className="ct-wa-title">WhatsApp Audit</h2>
            <p className="ct-wa-subtitle">
              Audits logged by chat analysts, by team and reply category. Separate from Records.
            </p>
          </div>
          <span className="ct-wa-live" title="New audits and category changes appear here automatically">
            <span className="ct-wa-live__dot" aria-hidden />
            Live
          </span>
        </header>

        <div className="ct-wa-stats">
          <div className="ct-wa-stat">
            <span className="ct-wa-stat__label">Matching audits</span>
            <span className="ct-wa-stat__value">{ready ? stats.inCategory.toLocaleString() : "–"}</span>
          </div>
          <div className="ct-wa-stat">
            <span className="ct-wa-stat__label">Share of team</span>
            <span className="ct-wa-stat__value">{ready ? `${stats.share}%` : "–"}</span>
          </div>
          <div className="ct-wa-stat">
            <span className="ct-wa-stat__label">Team audits</span>
            <span className="ct-wa-stat__value">{ready ? stats.teamTotal.toLocaleString() : "–"}</span>
          </div>
          <div className="ct-wa-stat">
            <span className="ct-wa-stat__label">Not categorized</span>
            <span className="ct-wa-stat__value">{ready ? stats.uncategorized.toLocaleString() : "–"}</span>
          </div>
        </div>

        <div className="ct-wa-toolbar">
          <label className="ct-wa-search">
            <Search size={15} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => resetView(() => setQuery(e.target.value))}
              placeholder="Search client, profile, analyst, shift or message"
              aria-label="Search audits"
            />
          </label>
          <div className="ct-wa-filter">
            <CtSelect
              aria-label="Filter by team"
              value={team}
              options={teamOptions}
              onChange={(v) => resetView(() => setTeam(v))}
              triggerStyle={FILTER_TRIGGER}
            />
          </div>
          <div className="ct-wa-filter ct-wa-filter--wide">
            <CtSelect
              aria-label="Filter by category"
              value={category}
              options={categoryFilterOptions}
              searchable={false}
              onChange={(v) => resetView(() => setCategory(v))}
              triggerStyle={FILTER_TRIGGER}
            />
          </div>
          <button
            type="button"
            className="ct-wa-reset"
            disabled={!filtersActive}
            onClick={() =>
              resetView(() => {
                setTeam(ALL);
                setCategory(ALL);
                setQuery("");
              })
            }
          >
            <RotateCcw size={14} aria-hidden />
            Reset
          </button>
        </div>

        <div className="ct-wa-notice" role={notice ? "alert" : undefined}>
          {notice ? (
            <>
              <AlertCircle size={14} aria-hidden /> {notice}
            </>
          ) : null}
        </div>

        <div className="ct-wa-scroll">
          <table className="ct-wa-table">
            <colgroup>
              <col style={{ width: 100 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 124 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 236 }} />
              <col />
              {canDelete ? <col style={{ width: 52 }} /> : null}
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} className={c.className}>
                    {c.label}
                  </th>
                ))}
                {canDelete ? <th aria-label="Actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {!ready && !schemaMissing ? (
                Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={`sk-${i}`} className="ct-wa-row--skeleton" aria-hidden>
                    {Array.from({ length: colCount }, (__, j) => (
                      <td key={j}>
                        <span className="ct-wa-skel" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="ct-wa-empty">
                    {audits.length === 0
                      ? "No audits logged yet. Chat analysts add them from “Log WhatsApp Audit”."
                      : "No audits match these filters."}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} title={r.analyst ? `Logged by ${r.analyst}` : undefined}>
                    <td className="ct-wa-nowrap">{formatAuditDate(r.date)}</td>
                    <td>{auditWeekday(r.date)}</td>
                    <td className="ct-wa-ellipsis" title={r.shift || undefined}>
                      {r.shift || <Dash />}
                    </td>
                    <td className="ct-wa-ellipsis" title={r.team || undefined}>
                      {r.team || <Dash />}
                    </td>
                    <td className="ct-wa-ellipsis" title={r.profile || undefined}>
                      {r.profile || <Dash />}
                    </td>
                    <td className="ct-wa-ellipsis ct-wa-strong" title={r.clientName || undefined}>
                      {r.clientName || <Dash />}
                    </td>
                    <td className="ct-wa-num">{timeOrDash(r.clientMsgReceived)}</td>
                    <td className="ct-wa-num">{timeOrDash(r.replyTime)}</td>
                    <td className="ct-wa-cat-cell">
                      <CategoryPicker
                        value={r.category}
                        state={saveStates[r.id]}
                        onChange={(next) => void saveCategory(r, next)}
                      />
                    </td>
                    <td className="ct-wa-ellipsis" title={r.clientMessage || undefined}>
                      {r.clientMessage || <Dash />}
                    </td>
                    {canDelete ? (
                      <td className="ct-wa-actions">
                        <button
                          type="button"
                          className="ct-wa-icon-btn"
                          aria-label={`Delete audit for ${r.clientName}`}
                          title="Delete audit"
                          onClick={() => {
                            setDeleteError("");
                            setConfirmDelete(r);
                          }}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="ct-wa-foot">
          <span className="ct-wa-foot__range">
            {ready ? (
              <>
                Showing <strong>{rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}</strong> of{" "}
                <strong>{rows.length.toLocaleString()}</strong> audits
              </>
            ) : schemaMissing ? (
              "Database setup required"
            ) : (
              "Loading audits…"
            )}
          </span>
          <div className="ct-wa-pager" role="group" aria-label="Pagination">
            <button
              type="button"
              disabled={activePage <= 0}
              onClick={() => setPage(Math.max(0, activePage - 1))}
            >
              Previous
            </button>
            <span className="ct-wa-pager__label">
              Page {activePage + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={activePage >= totalPages - 1}
              onClick={() => setPage(Math.min(totalPages - 1, activePage + 1))}
            >
              Next
            </button>
          </div>
        </footer>
      </section>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete this audit?"
        confirmLabel="Delete audit"
        danger
        busy={deleting}
        busyLabel="Deleting…"
        error={deleteError}
        onConfirm={() => void runDelete()}
        onCancel={() => {
          if (!deleting) setConfirmDelete(null);
        }}
      >
        {confirmDelete ? (
          <>
            The audit for <strong>{confirmDelete.clientName}</strong> on{" "}
            {formatAuditDate(confirmDelete.date)} will be removed for everyone. Chat records are not
            affected.
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
