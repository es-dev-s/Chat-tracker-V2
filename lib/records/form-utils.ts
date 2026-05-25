import { diffMins } from "@/lib/utils/format-duration";
import { formatStoredTimeDisplay } from "@/lib/utils/time-input";
import type { SessionUser } from "@/lib/auth/constants";
import { getUserTeamsList } from "@/lib/auth/scoping";

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
    received: 1,
    attempted: 1,
    resolved: 1,
  };
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

export type RecordTimeFieldKey =
  | "firstReceive"
  | "firstReply"
  | "clientLastReply"
  | "analystLastReply";

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

function buildBeforeReceiveError(
  field: Exclude<RecordTimeFieldKey, "firstReceive">,
  enteredRaw: string,
  receiveRaw: string,
): RecordTimeFieldError {
  const fieldLabel = REPLY_TIME_LABELS[field];
  return {
    field,
    kind: "before_receive",
    title: `${fieldLabel} is too early`,
    detail: `Set ${fieldLabel.toLowerCase()} at or after when the chat was received.`,
    enteredTime: formatStoredTimeDisplay(enteredRaw),
    anchorLabel: "1st Chat Receive",
    anchorTime: formatStoredTimeDisplay(receiveRaw),
  };
}

function buildBeforeFirstReplyError(
  enteredRaw: string,
  replyRaw: string,
): RecordTimeFieldError {
  return {
    field: "analystLastReply",
    kind: "before_first_reply",
    title: "Analyst last reply is out of order",
    detail: "Analyst last reply must be at or after your first reply.",
    enteredTime: formatStoredTimeDisplay(enteredRaw),
    anchorLabel: "1st Reply",
    anchorTime: formatStoredTimeDisplay(replyRaw),
  };
}

export function recordTimeFieldErrorMessage(error: RecordTimeFieldError): string {
  return `${error.title} — entered ${error.enteredTime}, must be at or after ${error.anchorLabel} (${error.anchorTime}).`;
}

/** Per-field errors when any reply time is before 1st Chat Receive or out of sequence. */
export function getRecordTimeFieldErrors(form: Record<string, string>): Partial<
  Record<RecordTimeFieldKey, RecordTimeFieldError>
> {
  const receiveRaw = String(form.firstReceive ?? "").trim();
  const firstReceive = parseClockMinutes(receiveRaw);
  const firstReply = parseClockMinutes(form.firstReply ?? "");
  const clientLast = parseClockMinutes(form.clientLastReply ?? "");
  const analystLast = parseClockMinutes(form.analystLastReply ?? "");
  const errors: Partial<Record<RecordTimeFieldKey, RecordTimeFieldError>> = {};

  if (firstReceive == null) return errors;

  if (firstReply != null && firstReply < firstReceive) {
    errors.firstReply = buildBeforeReceiveError(
      "firstReply",
      String(form.firstReply ?? ""),
      receiveRaw,
    );
  }
  if (clientLast != null && clientLast < firstReceive) {
    errors.clientLastReply = buildBeforeReceiveError(
      "clientLastReply",
      String(form.clientLastReply ?? ""),
      receiveRaw,
    );
  }
  if (analystLast != null && analystLast < firstReceive) {
    errors.analystLastReply = buildBeforeReceiveError(
      "analystLastReply",
      String(form.analystLastReply ?? ""),
      receiveRaw,
    );
  }

  if (
    firstReply != null &&
    analystLast != null &&
    analystLast < firstReply &&
    !errors.analystLastReply
  ) {
    errors.analystLastReply = buildBeforeFirstReplyError(
      String(form.analystLastReply ?? ""),
      String(form.firstReply ?? ""),
    );
  }

  return errors;
}

/** Log Chat: map analyst-last errors onto 1st Reply when that checkbox supplies the value. */
export function getLogChatTimeFieldErrors(
  form: Pick<
    LogFormState,
    "firstReceive" | "firstReply" | "clientLastReply" | "analystLastReply"
  >,
  useFirstReplyAsLast: boolean,
): Partial<Record<RecordTimeFieldKey, RecordTimeFieldError>> {
  const effectiveAnalystLast =
    !form.clientLastReply && useFirstReplyAsLast
      ? form.firstReply
      : form.analystLastReply;

  const errors = getRecordTimeFieldErrors({
    firstReceive: form.firstReceive,
    firstReply: form.firstReply,
    clientLastReply: form.clientLastReply,
    analystLastReply: effectiveAnalystLast,
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

export function validateRecordTimeOrdering(form: Record<string, string>): {
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

export function buildChatRecordFromForm(
  form: LogFormState,
  user: SessionUser,
  useFirstReplyAsLast: boolean,
): Omit<import("@/lib/db/records").ChatRecord, "id"> {
  const nowIso = new Date().toISOString();
  const analystLastReply =
    !form.clientLastReply && useFirstReplyAsLast ? form.firstReply : form.analystLastReply;
  const noteTrim = (form.note || "").trim();
  const replyDiff = diffMins(form.firstReceive, form.firstReply);
  const totalConv = diffMins(form.firstReceive, analystLastReply);
  return {
    date: form.date,
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
