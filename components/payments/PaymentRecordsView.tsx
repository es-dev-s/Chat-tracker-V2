"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CtDateInput from "@/components/ui/CtDateInput";
import CtSelect from "@/components/ui/CtSelect";
import { FILTER_TRIGGER, Dash } from "@/components/whatsapp-audit/audit-ui";
import {
  createPaymentRecord,
  deletePaymentRecord,
  updatePaymentRecord,
} from "@/lib/api/payment-record-mutations";
import { getUserTeamsList } from "@/lib/auth/scoping";
import {
  canAddPayment,
  canManagePayment,
  canSeeTopReceivers,
  canViewPaymentPage,
} from "@/lib/payment-records/access";
import {
  emptyPaymentDraft,
  formatAmount,
  formatAud,
  formatPaymentDate,
  paymentToDraft,
  periodOverlaps,
  topPaymentReceivers,
  type PaymentRecord,
  type PaymentRecordInput,
} from "@/lib/payment-records/types";
import { inputStyle } from "@/lib/styles/controls";
import { makeDisplayName } from "@/lib/utils/display-name";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { usePaymentRecords } from "@/hooks/usePaymentRecords";
import PaymentRecordFormDialog from "./PaymentRecordFormDialog";
import TopReceivers from "./TopReceivers";

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;
const SKELETON_ROWS = 8;
const ALL = "__all__";

type Dialog = { mode: "add" } | { mode: "edit"; record: PaymentRecord } | null;
type Banner = { kind: "success" | "error"; text: string } | null;

const SUBTITLE: Record<string, string> = {
  analyst: "Add the payments you received. Once a record is saved it can't be edited or deleted.",
  mainTeamLead: "All payment records. You can add, edit and delete records.",
  teamLead: "Payment records added by chat analysts. View only.",
};

function periodText(from: string, to: string): string {
  if (from && to) return `${formatPaymentDate(from)} – ${formatPaymentDate(to)}`;
  if (from) return `From ${formatPaymentDate(from)}`;
  if (to) return `Up to ${formatPaymentDate(to)}`;
  return "All time";
}

/**
 * Payment Records page for all three roles. What each role can do is decided by
 * lib/payment-records/access.ts (the API enforces the same rules).
 */
export default function PaymentRecordsView() {
  const user = useAuthStore((s) => s.user);
  const allowed = !!user && canViewPaymentPage(user);
  const { records, status, error: loadError, schemaMissing } = usePaymentRecords(allowed ? user?.id : null);
  const wsTeams = useWorkspaceStore((s) => s.teams);
  const wsProfiles = useWorkspaceStore((s) => s.profiles);
  const wsUsers = useWorkspaceStore((s) => s.users);

  const canAdd = !!user && canAddPayment(user);
  const canManage = user?.role === "mainTeamLead";
  const showTop = !!user && canSeeTopReceivers(user);
  const isAnalyst = user?.role === "analyst";
  const ready = status === "ready" || (status === "error" && records.length > 0);

  const [team, setTeam] = useState(ALL);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateEpoch, setDateEpoch] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [confirmDelete, setConfirmDelete] = useState<PaymentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [banner, setBanner] = useState<Banner>(null);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach((t) => window.clearTimeout(t));
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  /** Date filter: records whose payment period overlaps the chosen range. */
  const dateRows = useMemo(
    () => records.filter((r) => periodOverlaps(r, from, to)),
    [records, from, to],
  );

  const teamOptions = useMemo(() => {
    const names = [...new Set(dateRows.map((r) => r.team).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [{ value: ALL, label: "All teams" }, ...names.map((n) => ({ value: n }))];
  }, [dateRows]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dateRows.filter((r) => {
      if (team !== ALL && r.team !== team) return false;
      if (!q) return true;
      return [r.team, r.profile, r.analyst, r.clientName, r.clientNumber].some((v) => v.toLowerCase().includes(q));
    });
  }, [dateRows, team, query]);

  const stats = useMemo(() => {
    let cents = 0;
    let payments = 0;
    for (const r of rows) {
      cents += Math.round(r.totalAmount * 100);
      payments += r.paymentCount;
    }
    return { records: rows.length, total: cents / 100, payments };
  }, [rows]);

  // Ranking follows the date filter so "top receivers this month" works; team / search don't narrow it.
  const topReceivers = useMemo(() => (showTop ? topPaymentReceivers(dateRows, 3) : []), [showTop, dateRows]);

  const form = useMemo(() => {
    if (!user) return { teams: [], profiles: [], analysts: [] as string[] };
    if (user.role === "analyst") {
      const profiles = Array.isArray(user.profileNames) ? user.profileNames : [];
      return {
        teams: getUserTeamsList(user),
        profiles: [...profiles].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
        analysts: [makeDisplayName(user)],
      };
    }
    const uniq = (list: string[]) =>
      [...new Map(list.filter(Boolean).map((v) => [v.toLowerCase(), v])).values()].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
    return {
      teams: uniq([...wsTeams, ...getUserTeamsList(user), ...records.map((r) => r.team)]),
      profiles: uniq([...wsProfiles, ...records.map((r) => r.profile)]),
      analysts: uniq([
        ...wsUsers.filter((u) => u.role === "analyst").map((u) => makeDisplayName(u)),
        ...records.map((r) => r.analyst),
      ]),
    };
  }, [user, wsTeams, wsProfiles, wsUsers, records]);

  const flash = (b: Banner, ms = 4500) => {
    setBanner(b);
    if (b?.kind === "success") later(() => setBanner(null), ms);
  };

  const resetView = (fn: () => void) => {
    fn();
    setPage(0);
  };

  const filtersActive = team !== ALL || query.trim() !== "" || from !== "" || to !== "";

  const saveDialog = async (value: PaymentRecordInput) => {
    if (!dialog) return;
    const editing = dialog.mode === "edit" ? dialog.record : null;
    const saved = editing ? await updatePaymentRecord(editing.id, value) : await createPaymentRecord(value);
    setDialog(null);
    setHighlightId(saved.id);
    later(() => setHighlightId((id) => (id === saved.id ? null : id)), 2600);
    // Show the new record: clear filters that would hide it and go to the first page.
    setTeam(ALL);
    setQuery("");
    setFrom("");
    setTo("");
    setDateEpoch((n) => n + 1);
    setPage(0);
    flash({ kind: "success", text: editing ? "Payment record updated." : "Payment record added." });
  };

  const runDelete = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deletePaymentRecord(confirmDelete.id);
      setConfirmDelete(null);
      flash({ kind: "success", text: "Payment record deleted." });
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete this record.");
    } finally {
      setDeleting(false);
    }
  };

  if (!user || !allowed) return null;

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  // Clamp at render so live deletes and filter changes never strand you on an empty page.
  const activePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(activePage * pageSize, (activePage + 1) * pageSize);
  const rangeStart = rows.length ? activePage * pageSize + 1 : 0;
  const rangeEnd = activePage * pageSize + pageRows.length;
  const colCount = 9 + (canManage ? 1 : 0);
  const notice = schemaMissing
    ? "Payment Records is not set up on the database yet. Run supabase/cloud-scripts/payment_records.sql, then reload."
    : status === "error"
      ? loadError
      : "";

  return (
    <div className="ct-wa-page ct-pay-page">
      <section className="ct-card ct-wa-card">
        <header className="ct-wa-head">
          <div className="ct-wa-head__title">
            <h2 className="ct-wa-title">Payment Records</h2>
            <p className="ct-wa-subtitle">{SUBTITLE[user.role] ?? SUBTITLE.teamLead}</p>
          </div>
          <div className="ct-pay-head__actions">
            <span className="ct-wa-live" title="New and changed records appear here automatically">
              <span className="ct-wa-live__dot" aria-hidden />
              Live
            </span>
            {canAdd ? (
              <button
                type="button"
                className="ct-wal-btn ct-wal-btn--primary ct-pay-add"
                onClick={() => setDialog({ mode: "add" })}
                disabled={schemaMissing}
              >
                <Plus size={16} aria-hidden /> Add Record
              </button>
            ) : null}
          </div>
        </header>

        {showTop ? (
          <TopReceivers receivers={topReceivers} periodLabel={periodText(from, to)} loading={!ready} />
        ) : null}

        <div className="ct-wa-stats ct-pay-stats">
          <div className="ct-wa-stat">
            <span className="ct-wa-stat__label">Records</span>
            <span className="ct-wa-stat__value">{ready ? stats.records.toLocaleString() : "–"}</span>
          </div>
          <div className="ct-wa-stat">
            <span className="ct-wa-stat__label">Total payment amount</span>
            <span className="ct-wa-stat__value ct-pay-stat__money">{ready ? formatAud(stats.total) : "–"}</span>
          </div>
          <div className="ct-wa-stat">
            <span className="ct-wa-stat__label">Number of payments</span>
            <span className="ct-wa-stat__value">{ready ? stats.payments.toLocaleString() : "–"}</span>
          </div>
        </div>

        <div className="ct-pay-toolbar">
          <label className="ct-wa-search ct-pay-toolbar__search">
            <Search size={15} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => resetView(() => setQuery(e.target.value))}
              placeholder="Search team, profile, analyst or client"
              aria-label="Search payment records"
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
          <div className="ct-pay-daterange" role="group" aria-label="Filter by payment period">
            <CtDateInput
              key={`from-${dateEpoch}`}
              compact
              aria-label="Period from"
              value={from}
              max={to || undefined}
              inputStyleFn={inputStyle}
              onChange={(v) => resetView(() => setFrom(v))}
            />
            <span className="ct-pay-daterange__to" aria-hidden>
              to
            </span>
            <CtDateInput
              key={`to-${dateEpoch}`}
              compact
              aria-label="Period to"
              value={to}
              inputStyleFn={inputStyle}
              onChange={(v) => resetView(() => setTo(v))}
            />
          </div>
          <button
            type="button"
            className="ct-wa-reset"
            disabled={!filtersActive}
            onClick={() =>
              resetView(() => {
                setTeam(ALL);
                setQuery("");
                setFrom("");
                setTo("");
                setDateEpoch((n) => n + 1);
              })
            }
          >
            <RotateCcw size={14} aria-hidden />
            Reset
          </button>
        </div>

        <div
          className={`ct-pay-notice${banner ? ` ct-pay-notice--${banner.kind}` : ""}`}
          role={notice || banner?.kind === "error" ? "alert" : "status"}
        >
          {notice ? (
            <>
              <AlertCircle size={14} aria-hidden /> {notice}
            </>
          ) : banner ? (
            <>
              {banner.kind === "success" ? <CheckCircle2 size={14} aria-hidden /> : <AlertCircle size={14} aria-hidden />}{" "}
              {banner.text}
            </>
          ) : null}
        </div>

        <div className="ct-wa-scroll ct-pay-scroll">
          <table className="ct-wa-table ct-pay-table">
            <colgroup>
              <col style={{ width: 190 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 170 }} />
              <col style={{ width: 170 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 110 }} />
              {canManage ? <col style={{ width: 92 }} /> : null}
            </colgroup>
            <thead>
              <tr>
                <th>Period</th>
                <th>Team</th>
                <th>Profile Name</th>
                <th>Chat Analyst</th>
                <th>Client Name</th>
                <th>Client Number</th>
                <th className="ct-wa-num">Initial (AUD)</th>
                <th className="ct-wa-num">Final (AUD)</th>
                <th className="ct-wa-num">Payments</th>
                {canManage ? <th aria-label="Actions" /> : null}
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
                    {records.length === 0
                      ? canAdd
                        ? "No payment records yet. Use “Add Record” to create the first one."
                        : "No payment records yet."
                      : "No payment records match these filters."}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id} className={r.id === highlightId ? "ct-wal-row--new" : undefined}>
                    <td className="ct-wa-nowrap">
                      {formatPaymentDate(r.fromDate)} – {formatPaymentDate(r.toDate)}
                    </td>
                    <td className="ct-wa-ellipsis" title={r.team || undefined}>
                      {r.team || <Dash />}
                    </td>
                    <td className="ct-wa-ellipsis" title={r.profile || undefined}>
                      {r.profile || <Dash />}
                    </td>
                    <td className="ct-wa-ellipsis ct-wa-strong" title={r.analyst || undefined}>
                      {r.analyst || <Dash />}
                    </td>
                    <td className="ct-wa-ellipsis" title={r.clientName || undefined}>
                      {r.clientName || <Dash />}
                    </td>
                    <td className="ct-wa-ellipsis" title={r.clientNumber || undefined}>
                      {r.clientNumber || <Dash />}
                    </td>
                    <td className="ct-wa-num">{formatAmount(r.initialAmount)}</td>
                    <td className="ct-wa-num">{formatAmount(r.finalAmount)}</td>
                    <td className="ct-wa-num">{r.paymentCount.toLocaleString()}</td>
                    {canManage ? (
                      <td className="ct-wa-actions">
                        {canManagePayment(user, r) ? (
                          <span className="ct-pay-actions">
                            <button
                              type="button"
                              className="ct-pay-icon-btn"
                              aria-label={`Edit payment record for ${r.analyst}`}
                              title="Edit record"
                              onClick={() => setDialog({ mode: "edit", record: r })}
                            >
                              <Pencil size={14} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="ct-wa-icon-btn"
                              aria-label={`Delete payment record for ${r.analyst}`}
                              title="Delete record"
                              onClick={() => {
                                setDeleteError("");
                                setConfirmDelete(r);
                              }}
                            >
                              <Trash2 size={14} aria-hidden />
                            </button>
                          </span>
                        ) : null}
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
                Showing{" "}
                <strong>
                  {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
                </strong>{" "}
                of <strong>{rows.length.toLocaleString()}</strong> records
              </>
            ) : schemaMissing ? (
              "Database setup required"
            ) : (
              "Loading payment records…"
            )}
          </span>
          <div className="ct-wa-pager" role="group" aria-label="Pagination">
            <label className="ct-wa-pager__size">
              Rows
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(0);
                }}
                aria-label="Rows per page"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={activePage <= 0} onClick={() => setPage(Math.max(0, activePage - 1))}>
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

      {dialog ? (
        <PaymentRecordFormDialog
          key={dialog.mode === "edit" ? `edit-${dialog.record.id}` : "add"}
          mode={dialog.mode}
          initial={dialog.mode === "edit" ? paymentToDraft(dialog.record) : emptyPaymentDraft()}
          restricted={isAnalyst}
          requireConfirm={isAnalyst}
          teamOptions={form.teams}
          profileOptions={form.profiles}
          analystOptions={form.analysts}
          onSubmit={saveDialog}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete this payment record?"
        confirmLabel="Delete record"
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
            The {formatAud(confirmDelete.totalAmount)} record for <strong>{confirmDelete.analyst}</strong> (
            {formatPaymentDate(confirmDelete.fromDate)} – {formatPaymentDate(confirmDelete.toDate)}) will be removed
            for everyone. This can&apos;t be undone.
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
