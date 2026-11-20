"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, X } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CtDateInput from "@/components/ui/CtDateInput";
import CtSelect from "@/components/ui/CtSelect";
import { PaymentApiError } from "@/lib/api/payment-record-mutations";
import { applyPaymentViewerRules } from "@/lib/payment-records/access";
import {
  PAYMENT_FIELDS,
  PAYMENT_LIMITS,
  formatAud,
  formatPaymentDate,
  validatePaymentInput,
  type PaymentRecordDraft,
  type PaymentRecordField,
  type PaymentRecordFieldErrors,
  type PaymentRecordInput,
} from "@/lib/payment-records/types";
import { inputStyle } from "@/lib/styles/controls";
import { useAuthStore } from "@/store/auth-store";

/** Shown in the final confirmation before a Chat Analyst's record is saved. */
export const ANALYST_CONFIRM_MESSAGE =
  "Please check if any changes are left. Once added, this record cannot be edited or deleted.";

const FIELD_ID: Record<PaymentRecordField, string> = {
  fromDate: "pay-from",
  toDate: "pay-to",
  clientName: "pay-client-name",
  clientNumber: "pay-client-number",
  initialAmount: "pay-initial",
  finalAmount: "pay-final",
  paymentCount: "pay-count",
  team: "pay-team",
  profile: "pay-profile",
  analyst: "pay-analyst",
};

type Props = {
  mode: "add" | "edit";
  initial: PaymentRecordDraft;
  /**
   * Chat Analyst: team and profile are limited to their own and the analyst name is
   * fixed to them. Team Lead: any value, with suggestions.
   */
  restricted: boolean;
  /** Chat Analyst adds are final, so they get the "Please check…" confirmation first. */
  requireConfirm: boolean;
  teamOptions: string[];
  profileOptions: string[];
  analystOptions: string[];
  onSubmit: (value: PaymentRecordInput) => Promise<void>;
  onClose: () => void;
};

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`ct-wal-field${error ? " ct-wal-field--invalid" : ""}`}>
      <label className={`ct-wal-label${required ? " ct-wal-label--req" : ""}`} htmlFor={id}>
        {label}
      </label>
      {children}
      <div
        className={`ct-wal-field__msg${!error && hint ? " ct-wal-field__msg--hint" : ""}`}
        id={`${id}-msg`}
        role={error ? "alert" : undefined}
      >
        {error ? (
          <>
            <AlertCircle size={12} aria-hidden /> {error}
          </>
        ) : (
          hint
        )}
      </div>
    </div>
  );
}

export default function PaymentRecordFormDialog({
  mode,
  initial,
  restricted,
  requireConfirm,
  teamOptions,
  profileOptions,
  analystOptions,
  onSubmit,
  onClose,
}: Props) {
  const user = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState<PaymentRecordDraft>(initial);
  const [touched, setTouched] = useState<Set<PaymentRecordField>>(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<PaymentRecordFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);

  // A Chat Analyst's name, and a single team / profile, are filled in for them.
  const form = useMemo<PaymentRecordDraft>(() => {
    if (!restricted) return draft;
    return {
      ...draft,
      analyst: analystOptions[0] ?? draft.analyst,
      team: draft.team || (teamOptions.length === 1 ? teamOptions[0] : ""),
      profile: draft.profile || (profileOptions.length === 1 ? profileOptions[0] : ""),
    };
  }, [draft, restricted, analystOptions, teamOptions, profileOptions]);

  const { value, errors } = useMemo(() => {
    const base = validatePaymentInput(form);
    if (!restricted || !user) return base;
    const rules = applyPaymentViewerRules(user, base.value);
    const merged: PaymentRecordFieldErrors = { ...rules.errors, ...base.errors };
    return { value: rules.value, errors: merged };
  }, [form, restricted, user]);

  const shown = (f: PaymentRecordField): string | undefined =>
    serverErrors[f] ?? (submitted || touched.has(f) ? errors[f] : undefined);

  const setField = (key: PaymentRecordField, v: string) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, [key]: v }));
    setTouched((t) => (t.has(key) ? t : new Set(t).add(key)));
    setServerErrors((e) => {
      if (!(key in e)) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
    setFormError("");
  };
  const touch = (key: PaymentRecordField) => setTouched((t) => (t.has(key) ? t : new Set(t).add(key)));

  useEffect(() => {
    document.getElementById(FIELD_ID.fromDate)?.focus();
  }, []);

  // Escape closes an untouched form; once something is typed it must be closed on purpose.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirming && !saving && !dirty.current) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, saving, onClose]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setFormError("");
    try {
      await onSubmit(value);
    } catch (e) {
      if (e instanceof PaymentApiError && Object.keys(e.fields).length) setServerErrors(e.fields);
      setConfirming(false);
      setFormError(e instanceof Error ? e.message : "Could not save. Please try again.");
      setSaving(false);
    }
  };

  const submit = () => {
    if (saving) return;
    setSubmitted(true);
    const invalid = PAYMENT_FIELDS.filter((f) => errors[f]);
    if (invalid.length) {
      setFormError(
        invalid.length === 1 ? errors[invalid[0]]! : `Fix the ${invalid.length} highlighted fields to save.`,
      );
      document.getElementById(FIELD_ID[invalid[0]])?.focus();
      return;
    }
    if (requireConfirm) setConfirming(true);
    else void save();
  };

  const ctl = (f: PaymentRecordField, extra: React.CSSProperties = {}) =>
    inputStyle({
      minHeight: 42,
      ...(shown(f) ? { borderColor: "#f04438", boxShadow: "0 0 0 3px rgba(240, 68, 56, 0.12)" } : {}),
      ...extra,
    });
  const describe = (f: PaymentRecordField) => `${FIELD_ID[f]}-msg`;

  const money = (f: "initialAmount" | "finalAmount", label: string) => (
    <Field id={FIELD_ID[f]} label={`${label} (AUD)`} required error={shown(f)}>
      <div className="ct-pay-money">
        <span className="ct-pay-money__unit" aria-hidden>
          AUD
        </span>
        <input
          id={FIELD_ID[f]}
          style={ctl(f, { paddingLeft: 52 })}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={form[f]}
          onChange={(e) => setField(f, e.target.value.replace(/[^\d.,]/g, ""))}
          onBlur={() => touch(f)}
          aria-invalid={!!shown(f)}
          aria-describedby={describe(f)}
        />
      </div>
    </Field>
  );

  /** Analyst: pick from their own list. Team Lead: free text with suggestions. */
  const pick = (f: "team" | "profile", label: string, options: string[]) => {
    const err = shown(f);
    if (restricted && options.length) {
      return (
        <Field id={FIELD_ID[f]} label={label} required error={err}>
          <CtSelect
            id={FIELD_ID[f]}
            aria-label={label}
            openListHighlight="none"
            searchable={options.length > 6}
            searchPlaceholder={`Search ${label.toLowerCase()}…`}
            value={options.find((o) => o.toLowerCase() === form[f].toLowerCase()) ?? ""}
            onChange={(v) => setField(f, v)}
            disabled={options.length === 1}
            options={[
              ...(options.length > 1 ? [{ value: "", label: `Select ${label.toLowerCase()}` }] : []),
              ...options.map((o) => ({ value: o, label: o })),
            ]}
            placeholder={`Select ${label.toLowerCase()}`}
            triggerStyle={ctl(f, { cursor: options.length === 1 ? "default" : "pointer" })}
          />
        </Field>
      );
    }
    const listId = `${FIELD_ID[f]}-options`;
    return (
      <Field id={FIELD_ID[f]} label={label} required error={err}>
        <input
          id={FIELD_ID[f]}
          style={ctl(f)}
          list={options.length ? listId : undefined}
          autoComplete="off"
          maxLength={PAYMENT_LIMITS.name}
          value={form[f]}
          onChange={(e) => setField(f, e.target.value)}
          onBlur={() => touch(f)}
          placeholder={label}
          aria-invalid={!!err}
          aria-describedby={describe(f)}
        />
        {options.length ? (
          <datalist id={listId}>
            {options.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        ) : null}
      </Field>
    );
  };

  if (typeof document === "undefined") return null;

  const title = mode === "add" ? "Add Payment Record" : "Edit Payment Record";

  return createPortal(
    <div role="presentation" className="ct-admin-modal-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-dialog-title"
        aria-busy={saving || undefined}
        className="ct-pay-dialog"
      >
        <header className="ct-pay-dialog__head">
          <div>
            <h2 id="pay-dialog-title" className="ct-pay-dialog__title">
              {title}
            </h2>
            <p className="ct-pay-dialog__sub">
              {requireConfirm
                ? "You will be asked to confirm before saving. Saved records can't be edited or deleted."
                : "All amounts are in Australian dollars (AUD)."}
            </p>
          </div>
          <button
            type="button"
            className="ct-pay-dialog__close"
            aria-label="Close"
            onClick={onClose}
            disabled={saving}
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <form
          className="ct-pay-dialog__body"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="ct-pay-grid ct-pay-grid--2">
            <Field id={FIELD_ID.fromDate} label="From Date" required error={shown("fromDate")}>
              <CtDateInput
                id={FIELD_ID.fromDate}
                aria-label="From Date"
                value={form.fromDate}
                onChange={(v) => setField("fromDate", v)}
                inputStyleFn={(extra) => ctl("fromDate", extra ?? {})}
              />
            </Field>
            <Field id={FIELD_ID.toDate} label="To Date" required error={shown("toDate")}>
              <CtDateInput
                id={FIELD_ID.toDate}
                aria-label="To Date"
                value={form.toDate}
                onChange={(v) => setField("toDate", v)}
                inputStyleFn={(extra) => ctl("toDate", extra ?? {})}
              />
            </Field>
          </div>

          <div className="ct-pay-grid ct-pay-grid--3">
            {money("initialAmount", "Initial Payment")}
            {money("finalAmount", "Final Payment")}
          </div>

          <div className="ct-pay-grid ct-pay-grid--2">
            <Field id={FIELD_ID.clientName} label="Client Name" required error={shown("clientName")}>
              <input
                id={FIELD_ID.clientName}
                style={ctl("clientName")}
                autoComplete="off"
                maxLength={PAYMENT_LIMITS.name}
                value={form.clientName}
                onChange={(e) => setField("clientName", e.target.value)}
                onBlur={() => touch("clientName")}
                placeholder="Client Name"
                aria-invalid={!!shown("clientName")}
                aria-describedby={describe("clientName")}
              />
            </Field>
            <Field id={FIELD_ID.clientNumber} label="Client Number" error={shown("clientNumber")} hint="Optional">
              <input
                id={FIELD_ID.clientNumber}
                style={ctl("clientNumber")}
                autoComplete="off"
                maxLength={PAYMENT_LIMITS.name}
                value={form.clientNumber}
                onChange={(e) => setField("clientNumber", e.target.value)}
                onBlur={() => touch("clientNumber")}
                placeholder="Client Number"
                aria-invalid={!!shown("clientNumber")}
                aria-describedby={describe("clientNumber")}
              />
            </Field>
          </div>

          <div className="ct-pay-grid ct-pay-grid--2">
            <Field id={FIELD_ID.paymentCount} label="Total Number of Payments" required error={shown("paymentCount")}>
              <input
                id={FIELD_ID.paymentCount}
                style={ctl("paymentCount")}
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 2"
                value={form.paymentCount}
                onChange={(e) => setField("paymentCount", e.target.value.replace(/\D/g, "").slice(0, 4))}
                onBlur={() => touch("paymentCount")}
                aria-invalid={!!shown("paymentCount")}
                aria-describedby={describe("paymentCount")}
              />
            </Field>
            {pick("team", "Team Name", teamOptions)}
          </div>

          <div className="ct-pay-grid ct-pay-grid--2">
            {pick("profile", "Profile Name", profileOptions)}
            {restricted ? (
              <Field
                id={FIELD_ID.analyst}
                label="Chat Analyst Name"
                required
                error={shown("analyst")}
                hint="Your name, filled in for you"
              >
                <input
                  id={FIELD_ID.analyst}
                  style={ctl("analyst", { background: "#f7f9fc", cursor: "default" })}
                  value={form.analyst}
                  readOnly
                  aria-describedby={describe("analyst")}
                />
              </Field>
            ) : (
              <Field id={FIELD_ID.analyst} label="Chat Analyst Name" required error={shown("analyst")}>
                <input
                  id={FIELD_ID.analyst}
                  style={ctl("analyst")}
                  list="pay-analyst-options"
                  autoComplete="off"
                  maxLength={PAYMENT_LIMITS.name}
                  value={form.analyst}
                  onChange={(e) => setField("analyst", e.target.value)}
                  onBlur={() => touch("analyst")}
                  placeholder="Chat Analyst Name"
                  aria-invalid={!!shown("analyst")}
                  aria-describedby={describe("analyst")}
                />
                <datalist id="pay-analyst-options">
                  {analystOptions.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </Field>
            )}
          </div>

          <footer className="ct-pay-dialog__foot">
            <div className="ct-pay-dialog__msg" role={formError ? "alert" : undefined}>
              {formError ? (
                <>
                  <AlertCircle size={14} aria-hidden /> {formError}
                </>
              ) : null}
            </div>
            <button type="button" className="ct-wal-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="ct-wal-btn ct-wal-btn--primary" disabled={saving}>
              {mode === "add" ? "Save Record" : "Save Changes"}
            </button>
          </footer>
        </form>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Add this payment record?"
        confirmLabel="Yes, add record"
        cancelLabel="Go back and review"
        busy={saving}
        busyLabel="Saving…"
        titleId="pay-confirm-title"
        onConfirm={() => void save()}
        onCancel={() => {
          if (!saving) setConfirming(false);
        }}
      >
        <p className="ct-pay-confirm__lead">{ANALYST_CONFIRM_MESSAGE}</p>
        <dl className="ct-pay-confirm__list">
          <div>
            <dt>Period</dt>
            <dd>
              {formatPaymentDate(value.fromDate)} – {formatPaymentDate(value.toDate)}
            </dd>
          </div>
          <div>
            <dt>Client</dt>
            <dd>
              {value.clientName}
              {value.clientNumber ? ` (${value.clientNumber})` : ""}
            </dd>
          </div>
          <div>
            <dt>Initial / Final</dt>
            <dd>
              {formatAud(value.initialAmount)} / {formatAud(value.finalAmount)}
            </dd>
          </div>
          <div>
            <dt>Payments</dt>
            <dd>{value.paymentCount}</dd>
          </div>
          <div>
            <dt>Team / Profile</dt>
            <dd>
              {value.team} / {value.profile}
            </dd>
          </div>
        </dl>
      </ConfirmDialog>
    </div>,
    document.body,
  );
}
