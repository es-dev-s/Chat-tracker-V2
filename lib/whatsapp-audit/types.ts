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
  };
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
export function validateAuditInput(raw: unknown): {
  value: WhatsAppAuditInput;
  errors: WhatsAppAuditFieldErrors;
} {
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

  const reply = normalizeAuditTime(src.replyTime);
  if (reply === null) errors.replyTime = "Enter a valid time.";
  else if (reply && received) {
    if (elapsedClockMins(parseTime(received), parseTime(reply)) == null) {
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
