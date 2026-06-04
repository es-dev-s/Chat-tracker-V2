import { isValidIsoDateString } from "@/lib/utils/date-iso";
import { formatStoredTimeDisplay } from "@/lib/utils/time-input";

export type TimeEventKey =
  | "firstReceive"
  | "firstReply"
  | "clientLastReply"
  | "analystLastReply";

export type TimeEventDateKey =
  | "firstReceiveDate"
  | "firstReplyDate"
  | "clientLastReplyDate"
  | "analystLastReplyDate";

export const TIME_EVENT_KEYS: readonly TimeEventKey[] = [
  "firstReceive",
  "firstReply",
  "clientLastReply",
  "analystLastReply",
] as const;

export const TIME_TO_DATE_KEY: Record<TimeEventKey, TimeEventDateKey> = {
  firstReceive: "firstReceiveDate",
  firstReply: "firstReplyDate",
  clientLastReply: "clientLastReplyDate",
  analystLastReply: "analystLastReplyDate",
};

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

/** Effective YYYY-MM-DD for an event (explicit per-field date or record date). */
export function resolveEventDate(
  eventDate: string | undefined | null,
  recordDate: string | undefined | null,
): string {
  const explicit = String(eventDate ?? "").trim();
  if (explicit && isValidIsoDateString(explicit)) return explicit;
  const base = String(recordDate ?? "").trim();
  if (base && isValidIsoDateString(base)) return base;
  return "";
}

/** Minutes since Unix epoch for ordering (local calendar date + clock). */
export function parseEventEpochMinutes(
  dateIso: string,
  timeStr: string,
): number | null {
  const date = resolveEventDate(dateIso, "");
  const mins = parseClockMinutes(timeStr);
  if (!date || mins == null) return null;
  const parts = date.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  const wholeH = Math.floor(mins / 60);
  const remM = mins % 60;
  const remS = (mins - wholeH * 60 - remM) * 60;
  dt.setHours(wholeH, remM, Math.round(remS));
  return dt.getTime() / 60_000;
}

export function diffEventMins(
  date1: string,
  time1: string,
  date2: string,
  time2: string,
  recordDate: string,
): number | null {
  const a = parseEventEpochMinutes(resolveEventDate(date1, recordDate), time1);
  const b = parseEventEpochMinutes(resolveEventDate(date2, recordDate), time2);
  if (a == null || b == null) return null;
  return b - a;
}

export function formatEventDateTimeDisplay(
  dateIso: string,
  timeStr: string,
  recordDate: string,
): string {
  const date = resolveEventDate(dateIso, recordDate);
  const time = formatStoredTimeDisplay(timeStr);
  if (!date && !time) return "—";
  if (!date) return time || "—";
  if (!time) return date;
  return `${date} ${time}`;
}

/** Persist null/empty when same as record date to keep legacy rows compact. */
export function persistEventDate(
  eventDate: string,
  recordDate: string,
): string | null {
  const resolved = resolveEventDate(eventDate, recordDate);
  const base = String(recordDate ?? "").trim();
  if (!resolved) return null;
  if (resolved === base) return null;
  return resolved;
}

export function readEventDateFromRecord(
  stored: string | null | undefined,
  recordDate: string,
): string {
  const explicit = String(stored ?? "").trim();
  if (explicit && isValidIsoDateString(explicit)) return explicit;
  return String(recordDate ?? "").trim();
}
