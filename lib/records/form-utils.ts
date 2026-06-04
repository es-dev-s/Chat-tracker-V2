import type { SessionUser } from "@/lib/auth/constants";
import { getUserTeamsList } from "@/lib/auth/scoping";
import {
  diffEventMins,
  formatEventDateTimeDisplay,
  parseEventEpochMinutes,
  persistEventDate,
  readEventDateFromRecord,
  resolveEventDate,
  TIME_TO_DATE_KEY,
  type TimeEventDateKey,
  type TimeEventKey,
} from "@/lib/utils/event-datetime";
import { formatStoredTimeDisplay } from "@/lib/utils/time-input";

export type LogFormState = {
  date: string;
  analyst: string;
  team: string;
  profile: string;
  clientName: string;
  phone: string;
  note: string;
  firstReceive: string;
  firstReply: string;
  clientLastReply: string;
  analystLastReply: string;
  firstReceiveDate: string;
  firstReplyDate: string;
  clientLastReplyDate: string;
  analystLastReplyDate: string;
  received: number;
  attempted: number;
  resolved: number;
};

export function emptyLogForm(): LogFormState {
  return {
    date: "",
    analyst: "",
    team: "",
    profile: "",
    clientName: "",
    phone: "",
    note: "",
    firstReceive: "",
    firstReply: "",
    clientLastReply: "",
    analystLastReply: "",
    firstReceiveDate: "",
    firstReplyDate: "",
    clientLastReplyDate: "",
    analystLastReplyDate: "",
    received: 1,
    attempted: 1,
    resolved: 1,
  };
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shouldCascadeEventDate(
  eventDate: string,
  oldRecordDate: string,
): boolean {
  const e = String(eventDate ?? "").trim();
  const old = String(oldRecordDate ?? "").trim();
  return !e || e === old;
}

/** When the ledger date changes, keep per-event dates aligned unless the analyst picked another day. */
export function cascadeRecordDateChange(
  form: LogFormState,
  newRecordDate: string,
): LogFormState {
  const old = String(form.date ?? "").trim();
  const next = String(newRecordDate ?? "").trim();
  if (!next || next === old) return { ...form, date: next };

  const patch = (eventDate: string) =>
    shouldCascadeEventDate(eventDate, old) ? next : eventDate;

  return {
    ...form,
    date: next,
    firstReceiveDate: patch(form.firstReceiveDate),
    firstReplyDate: patch(form.firstReplyDate),
    clientLastReplyDate: patch(form.clientLastReplyDate),
    analystLastReplyDate: patch(form.analystLastReplyDate),
  };
}

/** Initial log form with today and matching event dates. */
export function newLogFormWithToday(teamDefault = ""): LogFormState {
  const today = todayIso();
  return {
    ...emptyLogForm(),
    date: today,
    team: teamDefault,
    firstReceiveDate: today,
    firstReplyDate: today,
    clientLastReplyDate: today,
    analystLastReplyDate: today,
  };
}

/** Seed per-event dates from record `date` (and stored overrides when editing). */
export function logFormFromChatRecord(record: {
  date?: string;
  firstReceive?: string;
  firstReply?: string;
  clientLastReply?: string;
  analystLastReply?: string;
  firstReceiveDate?: string;
  firstReplyDate?: string;
  clientLastReplyDate?: string;
  analystLastReplyDate?: string;
  analyst?: string;
  team?: string;
  profile?: string;
  clientName?: string;
  phone?: string;
  note?: string;
  received?: number;
  attempted?: number;
  resolved?: number;
}): LogFormState {
  const baseDate = String(record.date ?? "").trim();
  return {
    ...emptyLogForm(),
    date: baseDate,
    analyst: String(record.analyst ?? ""),
    team: String(record.team ?? ""),
    profile: String(record.profile ?? ""),
    clientName: String(record.clientName ?? ""),
    phone: String(record.phone ?? ""),
    note: String(record.note ?? ""),
    firstReceive: String(record.firstReceive ?? ""),
    firstReply: String(record.firstReply ?? ""),
    clientLastReply: String(record.clientLastReply ?? ""),
    analystLastReply: String(record.analystLastReply ?? ""),
    firstReceiveDate: readEventDateFromRecord(record.firstReceiveDate, baseDate),
    firstReplyDate: readEventDateFromRecord(record.firstReplyDate, baseDate),
    clientLastReplyDate: readEventDateFromRecord(record.clientLastReplyDate, baseDate),
    analystLastReplyDate: readEventDateFromRecord(record.analystLastReplyDate, baseDate),
    received: Number(record.received ?? 1),
    attempted: Number(record.attempted ?? 1),
    resolved: Number(record.resolved ?? 1),
  };
}

export function recordCreatorLabel(user: SessionUser | null): string {
  if (!user) return "";
  const name = String(user.name || "").trim();
  if (name) return name;
  return String(user.email || "").trim();
}

export function outcomesRespectOrdering(form: {
  received: number;
  attempted: number;
  resolved: number;
}): boolean {
  const r = Number(form.received);
  const a = Number(form.attempted);
  const z = Number(form.resolved);
  if (![r, a, z].every((n) => n === 0 || n === 1)) return false;
  return a <= r && z <= a;
}

export type RecordTimeFieldKey = TimeEventKey;

const REPLY_TIME_LABELS: Record<
  Exclude<RecordTimeFieldKey, "firstReceive">,
  string
> = {
  firstReply: "1st Reply",
  clientLastReply: "Client Last Reply",
  analystLastReply: "Analyst Last Reply",
};

export type RecordTimeFieldError = {
  field: RecordTimeFieldKey;
  kind: "before_receive" | "before_first_reply";
  title: string;
  detail: string;
  enteredTime: string;
  anchorLabel: string;
  anchorTime: string;
};

type TimeFormSlice = {
  date: string;
  firstReceive: string;
  firstReply: string;
  clientLastReply: string;
  analystLastReply: string;
  firstReceiveDate?: string;
  firstReplyDate?: string;
  clientLastReplyDate?: string;
  analystLastReplyDate?: string;
};

function buildBeforeReceiveError(
  field: Exclude<RecordTimeFieldKey, "firstReceive">,
  form: TimeFormSlice,
): RecordTimeFieldError {
  const fieldLabel = REPLY_TIME_LABELS[field];
  const recordDate = String(form.date ?? "").trim();
  const dateKey = TIME_TO_DATE_KEY[field];
  return {
    field,
    kind: "before_receive",
    title: `${fieldLabel} is too early`,
    detail: `Set ${fieldLabel.toLowerCase()} at or after when the chat was received (date and time).`,
    enteredTime: formatEventDateTimeDisplay(
      form[dateKey] ?? "",
      String(form[field] ?? ""),
      recordDate,
    ),
    anchorLabel: "1st Chat Receive",
    anchorTime: formatEventDateTimeDisplay(
      form.firstReceiveDate ?? "",
      String(form.firstReceive ?? ""),
      recordDate,
    ),
  };
}

function buildBeforeFirstReplyError(form: TimeFormSlice): RecordTimeFieldError {
  const recordDate = String(form.date ?? "").trim();
  return {
    field: "analystLastReply",
    kind: "before_first_reply",
    title: "Analyst last reply is out of order",
    detail: "Analyst last reply must be at or after your first reply (date and time).",
    enteredTime: formatEventDateTimeDisplay(
      form.analystLastReplyDate ?? "",
      String(form.analystLastReply ?? ""),
      recordDate,
    ),
    anchorLabel: "1st Reply",
    anchorTime: formatEventDateTimeDisplay(
      form.firstReplyDate ?? "",
      String(form.firstReply ?? ""),
      recordDate,
    ),
  };
}

function parseClockMinutes(value: string): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [h, m, s = 0] = nums;
  if (h < 0 || m < 0 || m >= 60 || s < 0 || s >= 60) return null;
  return h * 60 + m + s / 60;
}

export function recordTimeFieldErrorMessage(error: RecordTimeFieldError): string {
  return `${error.title} — entered ${error.enteredTime}, must be at or after ${error.anchorLabel} (${error.anchorTime}).`;
}

/** Per-field errors when any reply is before 1st Chat Receive or out of sequence (date-aware). */
export function getRecordTimeFieldErrors(
  form: TimeFormSlice,
): Partial<Record<RecordTimeFieldKey, RecordTimeFieldError>> {
  const receiveAnchor = parseEventEpochForForm(form, "firstReceive");
  const errors: Partial<Record<RecordTimeFieldKey, RecordTimeFieldError>> = {};

  if (receiveAnchor == null) return errors;

  const firstReplyEpoch = parseEventEpochForForm(form, "firstReply");
  const clientLastEpoch = parseEventEpochForForm(form, "clientLastReply");
  const analystLastEpoch = parseEventEpochForForm(form, "analystLastReply");

  if (firstReplyEpoch != null && firstReplyEpoch < receiveAnchor) {
    errors.firstReply = buildBeforeReceiveError("firstReply", form);
  }
  if (clientLastEpoch != null && clientLastEpoch < receiveAnchor) {
    errors.clientLastReply = buildBeforeReceiveError("clientLastReply", form);
  }
  if (analystLastEpoch != null && analystLastEpoch < receiveAnchor) {
    errors.analystLastReply = buildBeforeReceiveError("analystLastReply", form);
  }

  const firstReplyAnchor = parseEventEpochForForm(form, "firstReply");
  if (
    firstReplyAnchor != null &&
    analystLastEpoch != null &&
    analystLastEpoch < firstReplyAnchor &&
    !errors.analystLastReply
  ) {
    errors.analystLastReply = buildBeforeFirstReplyError(form);
  }

  return errors;
}

function parseEventEpochForForm(
  form: TimeFormSlice,
  key: TimeEventKey,
): number | null {
  const time = String(form[key] ?? "").trim();
  if (!time) return null;
  const dateKey = TIME_TO_DATE_KEY[key] as TimeEventDateKey;
  const recordDate = String(form.date ?? "").trim();
  const dateIso = resolveEventDate(form[dateKey] ?? "", recordDate);
  return parseEventEpochMinutes(dateIso, time);
}

/** Log Chat: map analyst-last errors onto 1st Reply when that checkbox supplies the value. */
export function getLogChatTimeFieldErrors(
  form: Pick<
    LogFormState,
    | "date"
    | "firstReceive"
    | "firstReply"
    | "clientLastReply"
    | "analystLastReply"
    | "firstReceiveDate"
    | "firstReplyDate"
    | "clientLastReplyDate"
    | "analystLastReplyDate"
  >,
  useFirstReplyAsLast: boolean,
): Partial<Record<RecordTimeFieldKey, RecordTimeFieldError>> {
  const effectiveAnalystLast =
    !form.clientLastReply && useFirstReplyAsLast
      ? form.firstReply
      : form.analystLastReply;
  const effectiveAnalystLastDate =
    !form.clientLastReply && useFirstReplyAsLast
      ? form.firstReplyDate
      : form.analystLastReplyDate;

  const errors = getRecordTimeFieldErrors({
    ...form,
    analystLastReply: effectiveAnalystLast,
    analystLastReplyDate: effectiveAnalystLastDate,
  });

  if (
    !form.clientLastReply &&
    useFirstReplyAsLast &&
    !String(form.analystLastReply ?? "").trim() &&
    errors.analystLastReply
  ) {
    const { analystLastReply, ...rest } = errors;
    const mapped = analystLastReply!;
    return {
      ...rest,
      firstReply: {
        ...mapped,
        field: "firstReply",
        title:
          mapped.kind === "before_receive"
            ? "1st Reply is too early"
            : "1st Reply is out of order",
        detail:
          mapped.kind === "before_receive"
            ? "When used as analyst last reply, 1st reply must be at or after when the chat was received."
            : mapped.detail,
      },
    };
  }

  return errors;
}

export function validateRecordTimeOrdering(form: TimeFormSlice): {
  ok: boolean;
  message?: string;
} {
  const errors = getRecordTimeFieldErrors(form);
  const firstError = Object.values(errors)[0];
  if (firstError) return { ok: false, message: recordTimeFieldErrorMessage(firstError) };
  return { ok: true };
}

export function isValidRecordTime(value: string): boolean {
  const t = String(value ?? "").trim();
  if (!t) return true;
  return parseClockMinutes(t) != null;
}

export function computeReplyDiffMins(form: TimeFormSlice): number | null {
  return diffEventMins(
    form.firstReceiveDate ?? "",
    form.firstReceive ?? "",
    form.firstReplyDate ?? "",
    form.firstReply ?? "",
    String(form.date ?? "").trim(),
  );
}

export function computeTotalConvMins(
  form: TimeFormSlice,
  analystLastTime: string,
  analystLastDate: string,
): number | null {
  return diffEventMins(
    form.firstReceiveDate ?? "",
    form.firstReceive ?? "",
    analystLastDate,
    analystLastTime,
    String(form.date ?? "").trim(),
  );
}

export function buildChatRecordFromForm(
  form: LogFormState,
  user: SessionUser,
  useFirstReplyAsLast: boolean,
): Omit<import("@/lib/db/records").ChatRecord, "id"> {
  const nowIso = new Date().toISOString();
  const analystLastReply =
    !form.clientLastReply && useFirstReplyAsLast ? form.firstReply : form.analystLastReply;
  const analystLastDate =
    !form.clientLastReply && useFirstReplyAsLast
      ? form.firstReplyDate
      : form.analystLastReplyDate;

  const recordDate =
    resolveEventDate(form.firstReceiveDate, form.date) || String(form.date ?? "").trim();

  const replyDiff = computeReplyDiffMins({ ...form, date: recordDate });
  const totalConv = computeTotalConvMins(
    { ...form, date: recordDate },
    analystLastReply,
    analystLastDate,
  );

  const noteTrim = (form.note || "").trim();

  const storedReceiveDate = persistEventDate(form.firstReceiveDate, recordDate);
  const storedReplyDate = persistEventDate(form.firstReplyDate, recordDate);
  const storedClientDate = persistEventDate(form.clientLastReplyDate, recordDate);
  const storedAnalystDate = persistEventDate(analystLastDate, recordDate);

  return {
    date: recordDate,
    analyst: form.analyst,
    team: form.team,
    profile: String(form.profile || "").trim(),
    clientName: String(form.clientName || "").trim(),
    phone: form.phone,
    note: form.note,
    firstReceive: form.firstReceive,
    firstReply: form.firstReply,
    clientLastReply: form.clientLastReply,
    analystLastReply,
    firstReceiveDate: storedReceiveDate ?? "",
    firstReplyDate: storedReplyDate ?? "",
    clientLastReplyDate: storedClientDate ?? "",
    analystLastReplyDate: storedAnalystDate ?? "",
    received: form.received,
    attempted: form.attempted,
    resolved: form.resolved,
    replyDiff,
    totalConv,
    noteUpdatedAt: noteTrim ? nowIso : null,
    noteUpdatedBy: noteTrim ? user.email : null,
    leadNote: "",
    leadNoteUpdatedAt: null,
    leadNoteUpdatedBy: null,
    isLeadNoteOnly: false,
    createdBy: recordCreatorLabel(user) || user.email,
  };
}

export function getPrimaryUserTeam(user: SessionUser): string {
  const teams = getUserTeamsList(user);
  return teams[0] || user.teamName || "";
}

export function displayClient(record: {
  clientName?: string;
  profile?: string;
  phone?: string;
}): string {
  const client = String(record.clientName || "").trim();
  const profile = String(record.profile || "").trim();
  const phone = String(record.phone || "").trim();
  if (client && profile && client !== profile) return `${client} · ${profile}`;
  return client || profile || phone || "—";
}
