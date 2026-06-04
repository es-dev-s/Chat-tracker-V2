"use client";

import { useMemo, useState } from "react";
import { C, SANS } from "@/lib/design/tokens";
import { BusyLabel } from "@/components/ui/BusySpinner";
import { postChatRecord } from "@/lib/api/mutations";
import {
  buildChatRecordFromForm,
  emptyLogForm,
  isValidRecordTime,
  outcomesRespectOrdering,
  todayIso,
  getLogChatTimeFieldErrors,
  validateRecordTimeOrdering,
  type LogFormState,
} from "@/lib/records/form-utils";
import { diffMins, fmtMins } from "@/lib/utils/format-duration";
import { makeDisplayName } from "@/lib/utils/display-name";
import { getUserTeamsList } from "@/lib/auth/scoping";
import {
  btnStyle,
  cardStyle,
  fieldLabelStyle,
  inputStyle,
} from "@/lib/styles/controls";
import { useAuthStore } from "@/store/auth-store";
import CtCheckbox from "@/components/ui/CtCheckbox";
import CtDateInput from "@/components/ui/CtDateInput";
import CtSelect from "@/components/ui/CtSelect";
import LogTimePicker from "@/components/log/LogTimePicker";
import LogTimeFieldHint from "@/components/log/LogTimeFieldHint";
import LogOutcomeField, { type OutcomeKey } from "@/components/log/LogOutcomeField";

const TIME_FIELDS = [
  { label: "1st Chat Receive", key: "firstReceive" as const, required: true },
  { label: "1st Reply", key: "firstReply" as const, required: false },
  { label: "Client Last Reply", key: "clientLastReply" as const, required: false },
  { label: "Analyst Last Reply", key: "analystLastReply" as const, required: false },
];

const OUTCOME_FIELDS = [
  { label: "Chat Received", key: "received" as const },
  { label: "Chat Attempted", key: "attempted" as const },
  { label: "Chat Resolved", key: "resolved" as const },
];

export default function LogChatView() {
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState<LogFormState>(() => ({
    ...emptyLogForm(),
    date: todayIso(),
  }));
  const [useFirstReplyAsLast, setUseFirstReplyAsLast] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formEpoch, setFormEpoch] = useState(0);

  const assignedProfiles = useMemo(() => {
    if (!user || user.role !== "analyst") return [];
    const names = Array.isArray(user.profileNames) ? user.profileNames : [];
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [user]);

  const currentUserTeams = useMemo(
    () => (user ? getUserTeamsList(user) : []),
    [user],
  );

  const enforcedAnalystValue =
    user?.role === "analyst" ? makeDisplayName(user) : form.analyst;

  const enforcedTeamValue =
    user?.role === "analyst" && currentUserTeams.length === 1
      ? currentUserTeams[0] || form.team
      : form.team;

  const teamSelectValue =
    currentUserTeams.includes(form.team)
      ? form.team
      : currentUserTeams.length === 1
        ? currentUserTeams[0]
        : "";

  const logChatProfileSelectValue =
    assignedProfiles.length > 0 && assignedProfiles.some((n) => n === form.profile)
      ? form.profile
      : "";

  const logChatProfileMissing =
    assignedProfiles.length > 0 &&
    !assignedProfiles.some((n) => n === form.profile);

  const previewAnalystLast =
    !form.clientLastReply && useFirstReplyAsLast ? form.firstReply : form.analystLastReply;
  const previewReplyDiff = diffMins(form.firstReceive, form.firstReply);
  const previewTotalConv = diffMins(form.firstReceive, previewAnalystLast);

  const timeFieldErrors = useMemo(
    () => getLogChatTimeFieldErrors(form, useFirstReplyAsLast),
    [form, useFirstReplyAsLast],
  );
  const hasTimeOrderError = Object.keys(timeFieldErrors).length > 0;

  const setF = <K extends keyof LogFormState>(key: K, value: LogFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setOutcome = (key: OutcomeKey, value: number) => {
    const n = value >= 1 ? 1 : 0;
    setF(key, n as LogFormState[typeof key]);
  };

  const resetForm = () => {
    const defaultTeam =
      user?.role === "analyst" && currentUserTeams.length === 1
        ? currentUserTeams[0] || ""
        : "";
    setForm({ ...emptyLogForm(), date: todayIso(), team: defaultTeam });
    setUseFirstReplyAsLast(false);
    setFormError("");
    setFormEpoch((n) => n + 1);
  };

  const addRecord = async () => {
    if (!user) return;

    const normalizedForm: LogFormState = {
      ...form,
      analyst: enforcedAnalystValue,
      team: enforcedTeamValue,
      analystLastReply:
        !form.clientLastReply && useFirstReplyAsLast
          ? form.firstReply
          : form.analystLastReply,
    };

    if (
      !normalizedForm.analyst ||
      !normalizedForm.team ||
      !normalizedForm.date ||
      !normalizedForm.firstReceive
    ) {
      setFormError("Date, Analyst, Team and 1st Chat Receive are required.");
      return;
    }
    if (
      user.role === "analyst" &&
      currentUserTeams.length > 0 &&
      !currentUserTeams.includes(normalizedForm.team)
    ) {
      setFormError("Select one of your assigned teams.");
      return;
    }
    if (
      user.role === "analyst" &&
      assignedProfiles.length > 0 &&
      !assignedProfiles.some((n) => n === normalizedForm.profile)
    ) {
      setFormError("Select one of your assigned profiles before saving.");
      return;
    }
    if (!outcomesRespectOrdering(normalizedForm)) {
      setFormError("Chat outcomes must follow Received >= Attempted >= Resolved (0 or 1).");
      return;
    }
    const timeOrder = validateRecordTimeOrdering({
      firstReceive: normalizedForm.firstReceive,
      firstReply: normalizedForm.firstReply,
      clientLastReply: normalizedForm.clientLastReply,
      analystLastReply: normalizedForm.analystLastReply,
    });
    if (!timeOrder.ok) {
      setFormError(timeOrder.message || "Invalid time ordering.");
      return;
    }
    const timesOk = [
      normalizedForm.firstReceive,
      normalizedForm.firstReply,
      normalizedForm.clientLastReply,
      normalizedForm.analystLastReply,
    ].every(isValidRecordTime);
    if (!timesOk) {
      setFormError("Enter a valid time for each filled field.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const record = buildChatRecordFromForm(normalizedForm, user, useFirstReplyAsLast);
      await postChatRecord(record);
      resetForm();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save record.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: "none", margin: 0 }} aria-busy={saving || undefined}>
      <div style={cardStyle({ padding: "28px 32px" })}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            marginBottom: 26,
            color: C.text,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: C.accent }}>＋</span> Log New Chat Record
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={fieldLabelStyle()}>Date</div>
            <CtDateInput
              key={form.date || "__empty__"}
              value={form.date || ""}
              onChange={(v) => setF("date", v)}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={fieldLabelStyle()}>Chat Analyst</div>
            <input
              style={inputStyle()}
              value={enforcedAnalystValue}
              onChange={(e) => setF("analyst", e.target.value)}
              placeholder="Chat Analyst"
              readOnly={user.role === "analyst"}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={fieldLabelStyle()}>Team</div>
            {user.role === "analyst" && currentUserTeams.length > 0 ? (
              <CtSelect
                aria-label="Team assigned to your account"
                openListHighlight="none"
                value={teamSelectValue}
                onChange={(v) => setF("team", v)}
                disabled={currentUserTeams.length === 1}
                options={[
                  ...(currentUserTeams.length > 1
                    ? [{ value: "", label: "— Select team —" }]
                    : []),
                  ...currentUserTeams.map((name) => ({ value: name, label: name })),
                ]}
                placeholder="— Select team —"
                triggerStyle={inputStyle({
                  cursor: currentUserTeams.length === 1 ? "default" : "pointer",
                  minHeight: 42,
                })}
              />
            ) : (
              <input
                style={inputStyle()}
                value={form.team}
                onChange={(e) => setF("team", e.target.value)}
                placeholder="Team"
              />
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
          {assignedProfiles.length > 0 ? (
            <div style={{ minWidth: 0, alignSelf: "start" }}>
              <div style={fieldLabelStyle()}>Assigned profile (required)</div>
              <CtSelect
                aria-label="Profile assigned to your account"
                openListHighlight="none"
                value={logChatProfileSelectValue}
                onChange={(v) => setF("profile", v)}
                options={[
                  { value: "", label: "— Select profile —" },
                  ...assignedProfiles.map((name) => ({ value: name, label: name })),
                ]}
                placeholder="— Select profile —"
                triggerStyle={inputStyle({ cursor: "pointer", minHeight: 42 })}
              />
            </div>
          ) : null}
          <div style={{ minWidth: 0 }}>
            <div style={fieldLabelStyle()}>Client Name (Optional)</div>
            <input
              style={inputStyle()}
              name="log_chat_client_name"
              autoComplete="off"
              value={form.clientName}
              onChange={(e) => setF("clientName", e.target.value)}
              placeholder={
                assignedProfiles.length > 0
                  ? "Optional display name for this chat"
                  : "e.g. lead or display name"
              }
            />
            {assignedProfiles.length > 0 ? (
              <div style={{ color: C.muted, fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
                Optional: saved as client name on the record (shown separately from assigned
                profile in the ledger).
              </div>
            ) : (
              <div style={{ color: C.muted, fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
                No catalog profiles are assigned to you yet. Your lead can assign them under User
                &amp; Teams. Optional text here is saved as{" "}
                <strong style={{ fontWeight: 600, color: C.label }}>Client name</strong> in the
                ledger (not Profile).
              </div>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={fieldLabelStyle()}>Client phone</div>
            <input
              style={inputStyle()}
              name="log_chat_phone"
              autoComplete="off"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setF("phone", e.target.value)}
              placeholder="Digits or +country code (optional)"
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={fieldLabelStyle()}>Note (optional)</div>
          <textarea
            style={inputStyle({ minHeight: 70, resize: "vertical", fontFamily: SANS })}
            value={form.note}
            onChange={(e) => setF("note", e.target.value)}
            placeholder="Important info about this lead/chat"
          />
        </div>

        <section className="ct-log-time-panel" aria-labelledby="log-time-heading">
          <header className="ct-log-time-panel__head">
            <h3 id="log-time-heading" className="ct-log-time-panel__title">
              Time Tracking
            </h3>
            <p className="ct-log-time-panel__hint">
              Enter times in 12-hour format with AM/PM (auto-detected when omitted) or 24-hour.
              Window supports full-day entry (including Saturday 7:00 AM to 3:00 PM). You can log
              only <strong>1st Chat Receive</strong> and leave reply fields blank until someone
              responds — those chats appear as{" "}
              <span className="ct-log-time-panel__awaiting">Awaiting reply</span> on Records and
              in the Reply tracking filter on the dashboard.
            </p>
          </header>

          <div className="ct-log-time-board">
            {TIME_FIELDS.map(({ label, key, required }) => {
              const fieldError = timeFieldErrors[key];
              return (
                <div
                  key={key}
                  className={`ct-log-time-field${fieldError ? " ct-log-time-field--invalid" : ""}`}
                >
                  <label
                    className={`ct-log-time-field__label${required ? " ct-log-time-field__label--required" : ""}`}
                    htmlFor={`log-time-${key}`}
                  >
                    {label}
                  </label>
                  <LogTimePicker
                    key={`${key}-${formEpoch}`}
                    id={`log-time-${key}`}
                    aria-label={label}
                    value={form[key] || ""}
                    onChange={(v) => setF(key, v)}
                    allowClear={!required}
                    invalid={!!fieldError}
                    aria-describedby={fieldError ? `log-time-${key}-hint` : undefined}
                  />
                  <div className="ct-log-time-field__hint-layer" aria-hidden={!fieldError}>
                    {fieldError ? (
                      <LogTimeFieldHint
                        error={fieldError}
                        id={`log-time-${key}-hint`}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="ct-log-time-footer">
            <CtCheckbox
              checked={useFirstReplyAsLast}
              onChange={setUseFirstReplyAsLast}
              disabled={!!form.clientLastReply}
            >
              Use 1st reply as analyst last reply when client last reply is missing
            </CtCheckbox>

            {(previewReplyDiff != null || previewTotalConv != null) && (
              <dl className="ct-log-time-metrics">
                {previewReplyDiff != null && (
                  <div className="ct-log-time-metric ct-log-time-metric--reply-diff">
                    <dt className="ct-log-time-metric__label">Reply difference</dt>
                    <dd className="ct-log-time-metric__value">{fmtMins(previewReplyDiff)}</dd>
                  </div>
                )}
                {previewTotalConv != null && (
                  <div className="ct-log-time-metric">
                    <dt className="ct-log-time-metric__label">Total conversation</dt>
                    <dd className="ct-log-time-metric__value">{fmtMins(previewTotalConv)}</dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </section>

        <section className="ct-log-outcomes" aria-labelledby="log-outcomes-heading">
          <h3 id="log-outcomes-heading" className="ct-log-outcomes__title">
            Chat outcomes
          </h3>
          <p className="ct-log-outcomes__hint">
            Enter <strong>0</strong> or <strong>1</strong> for each field. Order must follow
            Received ≥ Attempted ≥ Resolved.
          </p>
          <div className="ct-log-outcomes__grid">
            {OUTCOME_FIELDS.map(({ label, key }) => (
              <LogOutcomeField
                key={key}
                id={`log-outcome-${key}`}
                label={label}
                value={form[key]}
                onChange={(v) => setOutcome(key, v)}
              />
            ))}
          </div>
        </section>

        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button
            type="button"
            style={btnStyle("primary")}
            onClick={addRecord}
            disabled={saving || hasTimeOrderError}
            aria-busy={saving || undefined}
          >
            {saving ? <BusyLabel label="Saving…" /> : "Save Record"}
          </button>
          <button type="button" style={btnStyle("secondary")} onClick={resetForm}>
            Reset
          </button>
          {saved && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                color: C.green,
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 16 }}>✓</span> Record saved!
            </div>
          )}
          {(!enforcedAnalystValue ||
            !enforcedTeamValue ||
            !form.date ||
            !form.firstReceive ||
            logChatProfileMissing) && (
            <span style={{ color: C.muted, fontSize: 12 }}>
              *{" "}
              {[
                (!enforcedAnalystValue ||
                  !enforcedTeamValue ||
                  !form.date ||
                  !form.firstReceive) &&
                  "Date, Analyst, Team and 1st Chat Receive",
                logChatProfileMissing && "Assigned profile",
              ]
                .filter(Boolean)
                .join(" · ")}{" "}
              required
            </span>
          )}
        </div>
        {formError && (
          <div style={{ color: C.red, fontSize: 12, marginTop: 10 }}>{formError}</div>
        )}
      </div>
    </div>
  );
}
