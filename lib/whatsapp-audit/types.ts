import { normalizeReplyTiming, type ReplyTiming } from "@/lib/records/reply-timing";
import { elapsedClockMins, parseTime } from "@/lib/utils/format-duration";
import { formatTimeStorage } from "@/lib/utils/time-input";

/**
 * WhatsApp Audit entry. Its own dataset (`public.whatsapp_audits`), separate
 * from chat records. Categories reuse the Reply timing slugs.
 */
export type WhatsAppAudit = {
  id: number;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  analyst: string;
  analystEmail: string;
  /** ISO YYYY-MM-DD. "Day" is derived from it. */
  date: string;
  shift: string;
  team: string;
  profile: string;
  clientName: string;
  /** HH:MM:SS */
  clientMsgReceived: string;
  /** HH:MM:SS or "" while the reply is pending. */
  replyTime: string;
  category: ReplyTiming | null;
  clientMessage: string;
  /** ISO date the client message arrived, or "" (older rows: same as `date`). */
  clientMsgDate: string;
  /** ISO date of the reply, or "" (older rows: inferred from the clock times). */
  replyDate: string;
};

export type WhatsAppAuditInput = {
  date: string;
  shift: string;
  team: string;
  profile: string;
  clientName: string;
  clientMsgReceived: string;
  replyTime: string;
  category: ReplyTiming | null;
  clientMessage: string;
  /** Optional. "" = same day as `date`. */
  clientMsgDate?: string;
  /** Optional. "" = inferred from the clock times. Ignored without a reply time. */
  replyDate?: string;
};

export type WhatsAppAuditField = keyof WhatsAppAuditInput;
export type WhatsAppAuditFieldErrors = Partial<Record<WhatsAppAuditField, string>>;

export const AUDIT_FIELDS: readonly WhatsAppAuditField[] = [
  "date",
  "shift",
  "team",
  "profile",
  "clientName",
  "clientMsgReceived",
  "replyTime",
  "category",
  "clientMessage",
  "clientMsgDate",
  "replyDate",
];

export const AUDIT_LIMITS = {
  shift: 40,
  team: 120,
  profile: 120,
  clientName: 200,
  clientMessage: 2000,
} as const;

export function emptyAuditInput(date = ""): WhatsAppAuditInput {
  return {
    date,
    shift: "",
    team: "",
    profile: "",
    clientName: "",
    clientMsgReceived: "",
    replyTime: "",
    category: null,
    clientMessage: "",
    clientMsgDate: "",
    replyDate: "",
  };
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Latest date an entry may use. The server allows "today" in the furthest-ahead
 * time zone (UTC+14) so a user's local today is never rejected; the form passes
 * the browser's local today.
 */
export function latestAuditDate(): string {
  return new Date(Date.now() + 14 * 3600_000).toISOString().slice(0, 10);
}

/** Received day: explicit date, else the entry date. */
export function effectiveReceivedDate(a: { date: string; clientMsgDate?: string }): string {
  return a.clientMsgDate || a.date;
}

/**
 * Reply day: explicit date, else inferred (a reply clock earlier than the
 * received clock is the next day). "" when there is no reply time.
 */
export function effectiveReplyDate(a: {
  date: string;
  clientMsgDate?: string;
  clientMsgReceived: string;
  replyTime: string;
  replyDate?: string;
}): string {
  if (!a.replyTime) return "";
  if (a.replyDate) return a.replyDate;
  const recvDate = effectiveReceivedDate(a);
  if (!isIsoDate(recvDate)) return "";
  const r = parseTime(a.clientMsgReceived);
  const p = parseTime(a.replyTime);
  if (r == null || p == null) return recvDate;
  return p < r ? addDaysIso(recvDate, 1) : recvDate;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** "9:05", "09:05:00" → "09:05:00"; anything else → null. Empty → "". */
export function normalizeAuditTime(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) return null;
  const [h, m, s = 0] = raw.split(":").map(Number);
  const out = formatTimeStorage(h, m, s);
  return out || null;
}

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function multiline(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

export const REPLY_ORDER_MESSAGE =
  "Reply time must be after Client Msg Received (a reply after midnight counts if it is within 12 hours).";

/**
 * Validates a full entry. Shared by the form (inline errors) and the API
 * (authoritative). Returns cleaned values plus per-field messages.
 */
export function validateAuditInput(
  raw: unknown,
  opts: { maxDate?: string } = {},
): {
  value: WhatsAppAuditInput;
  errors: WhatsAppAuditFieldErrors;
} {
  const maxDate = opts.maxDate || latestAuditDate();
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: WhatsAppAuditFieldErrors = {};

  const date = text(src.date);
  if (!date) errors.date = "Date is required.";
  else if (!isIsoDate(date)) errors.date = "Enter a valid date.";

  const shift = text(src.shift);
  if (shift.length > AUDIT_LIMITS.shift) errors.shift = `Shift must be ${AUDIT_LIMITS.shift} characters or fewer.`;

  const team = text(src.team);
  if (!team) errors.team = "Team is required.";
  else if (team.length > AUDIT_LIMITS.team) errors.team = "Team name is too long.";

  const profile = text(src.profile);
  if (profile.length > AUDIT_LIMITS.profile) errors.profile = "Profile name is too long.";

  const clientName = text(src.clientName);
  if (!clientName) errors.clientName = "Client name is required.";
  else if (clientName.length > AUDIT_LIMITS.clientName)
    errors.clientName = `Client name must be ${AUDIT_LIMITS.clientName} characters or fewer.`;

  const received = normalizeAuditTime(src.clientMsgReceived);
  if (received === null) errors.clientMsgReceived = "Enter a valid time.";
  else if (!received) errors.clientMsgReceived = "Client Msg Received is required.";

  const clientMsgDate = text(src.clientMsgDate);
  if (clientMsgDate) {
    if (!isIsoDate(clientMsgDate)) errors.clientMsgDate = "Enter a valid date.";
    else if (clientMsgDate > maxDate) errors.clientMsgDate = "Date can't be in the future.";
  }

  const reply = normalizeAuditTime(src.replyTime);
  // A reply date only means something with a reply time.
  const replyDate = reply ? text(src.replyDate) : "";
  if (replyDate) {
    if (!isIsoDate(replyDate)) errors.replyDate = "Enter a valid date.";
    else if (replyDate > maxDate) errors.replyDate = "Date can't be in the future.";
  }
  if (reply === null) errors.replyTime = "Enter a valid time.";
  else if (reply && received) {
    if (replyDate && !errors.replyDate && !errors.clientMsgDate && !errors.date) {
      const recvDay = clientMsgDate || date;
      if (replyDate < recvDay) {
        errors.replyDate = "Reply date can't be before the Client Msg Received date.";
      } else if (`${replyDate}T${reply}` < `${recvDay}T${received}`) {
        errors.replyTime = "Reply time must be after Client Msg Received.";
      }
    } else if (!replyDate && elapsedClockMins(parseTime(received), parseTime(reply)) == null) {
      errors.replyTime = REPLY_ORDER_MESSAGE;
    }
  }

  const rawCategory = src.category;
  let category: ReplyTiming | null = null;
  if (rawCategory != null && String(rawCategory).trim() !== "") {
    category = normalizeReplyTiming(rawCategory);
    if (!category) errors.category = "Choose one of the listed categories.";
  }

  const clientMessage = multiline(src.clientMessage);
  if (clientMessage.length > AUDIT_LIMITS.clientMessage)
    errors.clientMessage = `Client message must be ${AUDIT_LIMITS.clientMessage} characters or fewer.`;

  return {
    value: {
      date,
      shift,
      team,
      profile,
      clientName,
      clientMsgReceived: received || "",
      replyTime: reply || "",
      category,
      clientMessage,
      clientMsgDate,
      replyDate,
    },
    errors,
  };
}

/** Weekday name for an ISO date, independent of the browser time zone. */
export function auditWeekday(iso: string): string {
  if (!isIsoDate(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

/** ISO → M/D/YYYY like the audit sheet. */
export function formatAuditDate(iso: string): string {
  if (!isIsoDate(iso)) return iso || "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}/${y}`;
}
