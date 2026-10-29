"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardPen,
  Clock3,
  MessageSquareText,
  Pencil,
  RotateCcw,
  UserRound,
  X,
} from "lucide-react";
import { BusyLabel } from "@/components/ui/BusySpinner";
import CtDateInput from "@/components/ui/CtDateInput";
import CtSelect from "@/components/ui/CtSelect";
import LogTimePicker from "@/components/log/LogTimePicker";
import {
  AuditApiError,
  createWhatsAppAudit,
  updateWhatsAppAudit,
} from "@/lib/api/whatsapp-audit-mutations";
import { getUserTeamsList } from "@/lib/auth/scoping";
import { REPLY_TIMINGS, REPLY_TIMING_LABELS, type ReplyTiming } from "@/lib/records/reply-timing";
import { todayIso } from "@/lib/records/form-utils";
import { inputStyle } from "@/lib/styles/controls";
import { makeDisplayName } from "@/lib/utils/display-name";
import {
  AUDIT_LIMITS,
  auditWeekday,
  emptyAuditInput,
  formatAuditDate,
  validateAuditInput,
  type WhatsAppAudit,
  type WhatsAppAuditField,
  type WhatsAppAuditFieldErrors,
  type WhatsAppAuditInput,
} from "@/lib/whatsapp-audit/types";
import { useAuthStore } from "@/store/auth-store";
import { useWhatsAppAudits } from "@/hooks/useWhatsAppAudits";
import { CATEGORY_TONE, CategoryPill, Dash, replyGapLabel, timeOrDash } from "./audit-ui";

const RECENT_LIMIT = 25;
const FIELD_ORDER: WhatsAppAuditField[] = [
  "date",
  "shift",
  "team",
  "profile",
  "clientName",
  "clientMsgReceived",
  "replyTime",
  "category",
  "clientMessage",
];
const FIELD_ID: Record<WhatsAppAuditField, string> = {
  date: "wal-date",
  shift: "wal-shift",
  team: "wal-team",
  profile: "wal-profile",
  clientName: "wal-client",
  clientMsgReceived: "wal-received",
  replyTime: "wal-reply",
  category: "wal-category",
  clientMessage: "wal-message",
};

type Banner = { kind: "success" | "error"; text: string } | null;

function FieldError({ id, text }: { id: string; text?: string }) {
  return (
    <div className="ct-wal-field__msg" id={`${id}-msg`} role={text ? "alert" : undefined}>
      {text ? (
        <>
          <AlertCircle size={12} aria-hidden /> {text}
        </>
      ) : null}
    </div>
  );
}

function auditToInput(a: WhatsAppAudit): WhatsAppAuditInput {
  return {
    date: a.date,
    shift: a.shift,
    team: a.team,
    profile: a.profile,
    clientName: a.clientName,
    clientMsgReceived: a.clientMsgReceived,
    replyTime: a.replyTime,
    category: a.category,
    clientMessage: a.clientMessage,
  };
}

export default function LogWhatsAppAuditView() {
  const user = useAuthStore((s) => s.user);
  const { audits, status, error: loadError, schemaMissing } = useWhatsAppAudits(user?.id);

  const teams = useMemo(() => (user ? getUserTeamsList(user) : []), [user]);
  const assignedProfiles = useMemo(() => {
    const names = Array.isArray(user?.profileNames) ? user.profileNames : [];
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [user]);

  const defaults = (): WhatsAppAuditInput => ({
    ...emptyAuditInput(todayIso()),
    team: teams.length === 1 ? teams[0] : "",
    profile: assignedProfiles.length === 1 ? assignedProfiles[0] : "",
  });

  const [rawForm, setForm] = useState<WhatsAppAuditInput>(defaults);
  // Session can hydrate after first paint: a single team / profile is filled in at render.
  const form = useMemo<WhatsAppAuditInput>(
    () => ({
      ...rawForm,
      team: rawForm.team || (teams.length === 1 ? teams[0] : ""),
      profile: rawForm.profile || (assignedProfiles.length === 1 ? assignedProfiles[0] : ""),
    }),
    [rawForm, teams, assignedProfiles],
  );
  const [touched, setTouched] = useState<Set<WhatsAppAuditField>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<WhatsAppAuditFieldErrors>({});
  const [editing, setEditing] = useState<WhatsAppAudit | null>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [epoch, setEpoch] = useState(0);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const bannerTimer = useRef<number | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (bannerTimer.current) window.clearTimeout(bannerTimer.current);
    },
    [],
  );

  const errors = useMemo(() => {
    const { errors: base } = validateAuditInput(form);
    const out: WhatsAppAuditFieldErrors = { ...base };
    if (!out.team && teams.length && !teams.some((t) => t.toLowerCase() === form.team.trim().toLowerCase())) {
      out.team = "Select one of your teams.";
    }
    if (!out.profile && assignedProfiles.length && !assignedProfiles.includes(form.profile)) {
      out.profile = "Select one of your assigned profiles.";
    }
    return out;
  }, [form, teams, assignedProfiles]);

  const shown = (field: WhatsAppAuditField): string | undefined =>
    serverErrors[field] ?? (submitted || touched.has(field) ? errors[field] : undefined);

  const setField = <K extends WhatsAppAuditField>(key: K, value: WhatsAppAuditInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setTouched((t) => (t.has(key) ? t : new Set(t).add(key)));
    setServerErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
    if (banner?.kind === "error") setBanner(null);
  };
  const touch = (key: WhatsAppAuditField) =>
    setTouched((t) => (t.has(key) ? t : new Set(t).add(key)));

  const flash = (b: Banner, ms = 4000) => {
    if (bannerTimer.current) window.clearTimeout(bannerTimer.current);
    setBanner(b);
    if (b?.kind === "success") bannerTimer.current = window.setTimeout(() => setBanner(null), ms);
  };

  const clearValidation = () => {
    setTouched(new Set());
    setSubmitted(false);
    setServerErrors({});
  };

  const resetAll = () => {
    setForm(defaults());
    setEditing(null);
    clearValidation();
    setBanner(null);
    setEpoch((n) => n + 1);
  };

  /** After saving, keep date / shift / team / profile so the next entry is quick. */
  const resetForNext = () => {
    setForm((f) => ({
      ...emptyAuditInput(f.date),
      shift: f.shift,
      team: f.team,
      profile: f.profile,
    }));
    setEditing(null);
    clearValidation();
    setEpoch((n) => n + 1);
  };

  const startEdit = (a: WhatsAppAudit) => {
    setEditing(a);
    setForm(auditToInput(a));
    clearValidation();
    setBanner(null);
    setEpoch((n) => n + 1);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = async () => {
    if (saving) return;
    setSubmitted(true);
    const invalid = FIELD_ORDER.filter((f) => errors[f]);
    if (invalid.length) {
      flash({
        kind: "error",
        text: invalid.length === 1 ? errors[invalid[0]]! : `Fix the ${invalid.length} highlighted fields to save.`,
      });
      document.getElementById(FIELD_ID[invalid[0]])?.focus();
      return;
    }
    const { value } = validateAuditInput(form);
    setSaving(true);
    setBanner(null);
    try {
      const saved = editing
        ? await updateWhatsAppAudit(editing.id, value)
        : await createWhatsAppAudit(value);
      setHighlightId(saved.id);
      window.setTimeout(() => setHighlightId((id) => (id === saved.id ? null : id)), 2600);
      resetForNext();
      flash({
        kind: "success",
        text: editing
          ? "Changes saved. The WhatsApp Audit page is updated."
          : `Audit for ${saved.clientName} saved. It is now on the WhatsApp Audit page.`,
      });
    } catch (e) {
      if (e instanceof AuditApiError && Object.keys(e.fields).length) setServerErrors(e.fields);
      flash({ kind: "error", text: e instanceof Error ? e.message : "Could not save. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const shiftSuggestions = useMemo(() => {
    const seen = new Set<string>();
    for (const a of audits) if (a.shift.trim()) seen.add(a.shift.trim());
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).slice(0, 30);
  }, [audits]);

  const recent = useMemo(() => audits.slice(0, RECENT_LIMIT), [audits]);
  const today = todayIso();
  const todayCount = useMemo(() => audits.filter((a) => a.date === today).length, [audits, today]);

  if (!user) return null;

  const day = auditWeekday(form.date);
  const gap = replyGapLabel(form.clientMsgReceived, form.replyTime);
  const msgLen = form.clientMessage.length;
  const fieldClass = (f: WhatsAppAuditField) => `ct-wal-field${shown(f) ? " ct-wal-field--invalid" : ""}`;
  const ctl = (f: WhatsAppAuditField, extra: React.CSSProperties = {}) =>
    inputStyle({
      minHeight: 42,
      ...(shown(f) ? { borderColor: "#f04438", boxShadow: "0 0 0 3px rgba(240, 68, 56, 0.12)" } : {}),
      ...extra,
    });
  const describe = (f: WhatsAppAuditField) => (shown(f) ? `${FIELD_ID[f]}-msg` : undefined);

  return (
    <div className="ct-wal-page" ref={topRef} aria-busy={saving || undefined}>
      {schemaMissing ? (
        <div className="ct-wal-alert" role="alert">
          <AlertCircle size={16} aria-hidden />
          <span>
            WhatsApp Audit is not set up on the database yet. Ask your admin to run the
            <code> whatsapp_audits.sql </code> script, then reload.
          </span>
        </div>
      ) : null}

      <section className="ct-card ct-wal-card">
        <header className="ct-wal-head">
          <div className="ct-wal-head__icon" aria-hidden>
            <ClipboardPen size={20} />
          </div>
          <div className="ct-wal-head__text">
            <h2 className="ct-wal-title">{editing ? "Edit WhatsApp Audit" : "Log WhatsApp Audit"}</h2>
            <p className="ct-wal-subtitle">
              Each entry goes to the WhatsApp Audit review page. It is separate from chat records.
            </p>
          </div>
          <div className="ct-wal-head__meta">
            <span className="ct-wal-chip">
              <UserRound size={13} aria-hidden /> {makeDisplayName(user)}
            </span>
            <span className="ct-wal-chip ct-wal-chip--soft" title="Entries you logged for today">
              Today <strong>{status === "ready" ? todayCount : "–"}</strong>
            </span>
          </div>
        </header>

        {editing ? (
          <div className="ct-wal-editing">
            <Pencil size={14} aria-hidden />
            <span>
              Editing <strong>{editing.clientName}</strong> from {formatAuditDate(editing.date)}
            </span>
            <button type="button" className="ct-wal-link" onClick={resetAll}>
              <X size={13} aria-hidden /> Cancel edit
            </button>
          </div>
        ) : null}

        <form
          className="ct-wal-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <fieldset className="ct-wal-section">
            <legend className="ct-wal-section__title">
              <CalendarDays size={15} aria-hidden /> Chat details
            </legend>
            <div className="ct-wal-grid ct-wal-grid--4">
              <div className={fieldClass("date")}>
                <label className="ct-wal-label ct-wal-label--req" htmlFor={FIELD_ID.date}>
                  Date
                </label>
                <CtDateInput
                  key={`date-${epoch}`}
                  id={FIELD_ID.date}
                  value={form.date}
                  onChange={(v) => setField("date", v)}
                  inputStyleFn={(extra) => ctl("date", extra ?? {})}
                />
                <FieldError id={FIELD_ID.date} text={shown("date")} />
              </div>
              <div className="ct-wal-field">
                <span className="ct-wal-label">Day</span>
                <div className="ct-wal-readonly" aria-live="polite">
                  {day || <span className="ct-wa-muted">Pick a date</span>}
                </div>
                <div className="ct-wal-field__msg ct-wal-field__msg--hint">Filled from the date</div>
              </div>
              <div className={fieldClass("shift")}>
                <label className="ct-wal-label" htmlFor={FIELD_ID.shift}>
                  Shift
                </label>
                <input
                  id={FIELD_ID.shift}
                  style={ctl("shift")}
                  list="wal-shift-options"
                  autoComplete="off"
                  maxLength={AUDIT_LIMITS.shift}
                  value={form.shift}
                  onChange={(e) => setField("shift", e.target.value)}
                  onBlur={() => touch("shift")}
                  placeholder="e.g. 3 to 7"
                  aria-invalid={!!shown("shift")}
                  aria-describedby={describe("shift")}
                />
                <datalist id="wal-shift-options">
                  {shiftSuggestions.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
                <FieldError id={FIELD_ID.shift} text={shown("shift")} />
              </div>
              <div className={fieldClass("team")}>
                <label className="ct-wal-label ct-wal-label--req" htmlFor={FIELD_ID.team}>
                  Team
                </label>
                {teams.length ? (
                  <CtSelect
                    id={FIELD_ID.team}
                    aria-label="Team"
                    openListHighlight="none"
                    value={teams.find((t) => t.toLowerCase() === form.team.toLowerCase()) ?? ""}
                    onChange={(v) => setField("team", v)}
                    disabled={teams.length === 1}
                    options={[
                      ...(teams.length > 1 ? [{ value: "", label: "Select team" }] : []),
                      ...teams.map((t) => ({ value: t, label: t })),
                    ]}
                    placeholder="Select team"
                    triggerStyle={ctl("team", { cursor: teams.length === 1 ? "default" : "pointer" })}
                  />
                ) : (
                  <input
                    id={FIELD_ID.team}
                    style={ctl("team")}
                    value={form.team}
                    onChange={(e) => setField("team", e.target.value)}
                    onBlur={() => touch("team")}
                    placeholder="Team"
                    aria-invalid={!!shown("team")}
                    aria-describedby={describe("team")}
                  />
                )}
                <FieldError id={FIELD_ID.team} text={shown("team")} />
              </div>
            </div>
          </fieldset>

          <fieldset className="ct-wal-section">
            <legend className="ct-wal-section__title">
              <MessageSquareText size={15} aria-hidden /> Client
            </legend>
            <div className="ct-wal-grid ct-wal-grid--2">
              <div className={fieldClass("profile")}>
                <label
                  className={`ct-wal-label${assignedProfiles.length ? " ct-wal-label--req" : ""}`}
                  htmlFor={FIELD_ID.profile}
                >
                  Profile Name
                </label>
                {assignedProfiles.length ? (
                  <CtSelect
                    id={FIELD_ID.profile}
                    aria-label="Profile name"
                    openListHighlight="none"
                    searchable
                    searchPlaceholder="Search profiles…"
                    value={assignedProfiles.includes(form.profile) ? form.profile : ""}
                    onChange={(v) => setField("profile", v)}
                    options={[
                      { value: "", label: "Select profile" },
                      ...assignedProfiles.map((n) => ({ value: n, label: n })),
                    ]}
                    placeholder="Select profile"
                    triggerStyle={ctl("profile", { cursor: "pointer" })}
                  />
                ) : (
                  <input
                    id={FIELD_ID.profile}
                    style={ctl("profile")}
                    autoComplete="off"
                    maxLength={AUDIT_LIMITS.profile}
                    value={form.profile}
                    onChange={(e) => setField("profile", e.target.value)}
                    onBlur={() => touch("profile")}
                    placeholder="Profile used for this chat"
                    aria-invalid={!!shown("profile")}
                    aria-describedby={describe("profile")}
                  />
                )}
                <FieldError id={FIELD_ID.profile} text={shown("profile")} />
              </div>
              <div className={fieldClass("clientName")}>
                <label className="ct-wal-label ct-wal-label--req" htmlFor={FIELD_ID.clientName}>
                  Client Name
                </label>
                <input
                  id={FIELD_ID.clientName}
                  style={ctl("clientName")}
                  autoComplete="off"
                  maxLength={AUDIT_LIMITS.clientName}
                  value={form.clientName}
                  onChange={(e) => setField("clientName", e.target.value)}
                  onBlur={() => touch("clientName")}
                  placeholder="Client's name or WhatsApp display name"
                  aria-invalid={!!shown("clientName")}
                  aria-describedby={describe("clientName")}
                />
                <FieldError id={FIELD_ID.clientName} text={shown("clientName")} />
              </div>
            </div>
            <div className={fieldClass("clientMessage")}>
              <div className="ct-wal-label-row">
                <label className="ct-wal-label" htmlFor={FIELD_ID.clientMessage}>
                  Client message
                </label>
                <span className={`ct-wal-count${msgLen > AUDIT_LIMITS.clientMessage * 0.9 ? " ct-wal-count--warn" : ""}`}>
                  {msgLen}/{AUDIT_LIMITS.clientMessage}
                </span>
              </div>
              <textarea
                id={FIELD_ID.clientMessage}
                style={ctl("clientMessage", { minHeight: 84, resize: "vertical", lineHeight: 1.5, paddingTop: 10 })}
                rows={3}
                maxLength={AUDIT_LIMITS.clientMessage}
                value={form.clientMessage}
                onChange={(e) => setField("clientMessage", e.target.value)}
                onBlur={() => touch("clientMessage")}
                placeholder="What the client wrote, e.g. “Can you help me with this issue anytime”"
                aria-invalid={!!shown("clientMessage")}
                aria-describedby={describe("clientMessage")}
              />
              <FieldError id={FIELD_ID.clientMessage} text={shown("clientMessage")} />
            </div>
          </fieldset>

          <fieldset className="ct-wal-section">
            <legend className="ct-wal-section__title">
              <Clock3 size={15} aria-hidden /> Reply timing
            </legend>
            <div className="ct-wal-grid ct-wal-grid--3">
              <div className={fieldClass("clientMsgReceived")}>
                <label className="ct-wal-label ct-wal-label--req" htmlFor={FIELD_ID.clientMsgReceived}>
                  Client Msg Received
                </label>
                <LogTimePicker
                  key={`recv-${epoch}`}
                  id={FIELD_ID.clientMsgReceived}
                  aria-label="Client message received time"
                  value={form.clientMsgReceived}
                  onChange={(v) => setField("clientMsgReceived", v)}
                  allowClear={false}
                  invalid={!!shown("clientMsgReceived")}
                  aria-describedby={describe("clientMsgReceived")}
                />
                <FieldError id={FIELD_ID.clientMsgReceived} text={shown("clientMsgReceived")} />
              </div>
              <div className={fieldClass("replyTime")}>
                <label className="ct-wal-label" htmlFor={FIELD_ID.replyTime}>
                  Reply Time
                </label>
                <LogTimePicker
                  key={`reply-${epoch}`}
                  id={FIELD_ID.replyTime}
                  aria-label="Reply time"
                  value={form.replyTime}
                  onChange={(v) => setField("replyTime", v)}
                  invalid={!!shown("replyTime")}
                  aria-describedby={describe("replyTime")}
                />
                <FieldError id={FIELD_ID.replyTime} text={shown("replyTime")} />
              </div>
              <div className="ct-wal-field">
                <span className="ct-wal-label">Reply gap</span>
                <div className={`ct-wal-readonly ct-wal-gap${gap ? " ct-wal-gap--on" : ""}`}>
                  {gap ?? <span className="ct-wa-muted">{form.replyTime ? "—" : "Awaiting reply time"}</span>}
                </div>
                <div className="ct-wal-field__msg ct-wal-field__msg--hint">Replies after midnight are counted</div>
              </div>
            </div>

            <div className={fieldClass("category")}>
              <span className="ct-wal-label" id="wal-category-label">
                Category
              </span>
              <div
                className="ct-wal-cats"
                role="radiogroup"
                aria-labelledby="wal-category-label"
                id={FIELD_ID.category}
              >
                {([null, ...REPLY_TIMINGS] as (ReplyTiming | null)[]).map((t) => {
                  const active = form.category === t;
                  const tone = t ? CATEGORY_TONE[t] : null;
                  return (
                    <button
                      key={t ?? "none"}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`ct-wal-cat${active ? " ct-wal-cat--on" : ""}`}
                      style={
                        active && tone
                          ? { color: tone.fg, background: tone.bg, borderColor: tone.border }
                          : undefined
                      }
                      onClick={() => setField("category", t)}
                    >
                      {tone ? <span className="ct-wal-cat__dot" style={{ background: tone.fg }} aria-hidden /> : null}
                      {t ? REPLY_TIMING_LABELS[t] : "Not set"}
                    </button>
                  );
                })}
              </div>
              <FieldError id={FIELD_ID.category} text={shown("category")} />
            </div>
          </fieldset>

          <footer className="ct-wal-actions">
            <button type="submit" className="ct-wal-btn ct-wal-btn--primary" disabled={saving || schemaMissing}>
              {saving ? <BusyLabel label="Saving…" /> : editing ? "Save changes" : "Save audit"}
            </button>
            <button type="button" className="ct-wal-btn" onClick={resetAll} disabled={saving}>
              <RotateCcw size={14} aria-hidden /> {editing ? "Discard" : "Reset"}
            </button>
            <div className="ct-wal-banner-slot" aria-live="polite">
              {banner ? (
                <div className={`ct-wal-banner ct-wal-banner--${banner.kind}`} role={banner.kind === "error" ? "alert" : "status"}>
                  {banner.kind === "success" ? <CheckCircle2 size={15} aria-hidden /> : <AlertCircle size={15} aria-hidden />}
                  <span>{banner.text}</span>
                </div>
              ) : (
                <span className="ct-wal-req-note">
                  <span className="ct-wal-req-star">*</span> Required
                </span>
              )}
            </div>
          </footer>
        </form>
      </section>

      <section className="ct-card ct-wa-card ct-wal-recent">
        <header className="ct-wa-head">
          <div className="ct-wa-head__title">
            <h3 className="ct-wa-title ct-wal-recent__title">My recent audits</h3>
            <p className="ct-wa-subtitle">
              Your last {RECENT_LIMIT} entries. Category changes made by your leads show up here live.
            </p>
          </div>
          <span className="ct-wa-live">
            <span className="ct-wa-live__dot" aria-hidden />
            Live
          </span>
        </header>
        {loadError && !schemaMissing ? (
          <div className="ct-wa-notice" role="alert">
            <AlertCircle size={14} aria-hidden /> {loadError}
          </div>
        ) : (
          <div className="ct-wal-gap-8" />
        )}
        <div className="ct-wa-scroll ct-wal-recent__scroll">
          <table className="ct-wa-table ct-wa-table--compact">
            <colgroup>
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 220 }} />
              <col />
              <col style={{ width: 76 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Shift</th>
                <th>Profile Name</th>
                <th>Client Name</th>
                <th className="ct-wa-num">Client Msg Received</th>
                <th className="ct-wa-num">Reply Time</th>
                <th>Category</th>
                <th>Client message</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {status === "idle" || status === "loading" ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={`sk-${i}`} aria-hidden>
                    {Array.from({ length: 10 }, (__, j) => (
                      <td key={j}>
                        <span className="ct-wa-skel" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : recent.length === 0 ? (
                <tr>
                  <td colSpan={10} className="ct-wa-empty ct-wal-empty">
                    No audits yet. Entries you save above appear here.
                  </td>
                </tr>
              ) : (
                recent.map((a) => (
                  <tr
                    key={a.id}
                    className={`${highlightId === a.id ? "ct-wal-row--new" : ""}${editing?.id === a.id ? " ct-wal-row--editing" : ""}`}
                  >
                    <td className="ct-wa-nowrap">{formatAuditDate(a.date)}</td>
                    <td>{auditWeekday(a.date)}</td>
                    <td className="ct-wa-ellipsis" title={a.shift || undefined}>
                      {a.shift || <Dash />}
                    </td>
                    <td className="ct-wa-ellipsis" title={a.profile || undefined}>
                      {a.profile || <Dash />}
                    </td>
                    <td className="ct-wa-ellipsis ct-wa-strong" title={a.clientName}>
                      {a.clientName}
                    </td>
                    <td className="ct-wa-num">{timeOrDash(a.clientMsgReceived)}</td>
                    <td className="ct-wa-num">{timeOrDash(a.replyTime)}</td>
                    <td>
                      <CategoryPill value={a.category} />
                    </td>
                    <td className="ct-wa-ellipsis" title={a.clientMessage || undefined}>
                      {a.clientMessage || <Dash />}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ct-wal-row-btn"
                        onClick={() => startEdit(a)}
                        aria-label={`Edit audit for ${a.clientName}`}
                      >
                        <Pencil size={13} aria-hidden /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="ct-wa-foot">
          <span>
            {status === "ready" ? (
              <>
                Showing <strong>{recent.length}</strong> of <strong>{audits.length.toLocaleString()}</strong> entries
              </>
            ) : (
              "Loading your audits…"
            )}
          </span>
        </footer>
      </section>
    </div>
  );
}
