import { normalizeChatDirection } from "@/lib/records/chat-direction";
import { elapsedClockMins } from "@/lib/utils/format-duration";
/**
 * Validates `chatDirection` ('in' | 'out'). Required on create (except
 * lead-note-only rows). On update a
 * missing value keeps the stored one (legacy rows may have none); an explicit
 * non-empty value must be valid.
 */
export function withValidatedChatDirection<T extends Record<string, unknown>>(
  record: T,
  existingRow?: Record<string, unknown> | null,
): T {
  const raw = record?.chatDirection ?? record?.chat_direction;
  const empty = raw === undefined || raw === null || String(raw).trim() === "";
  if (empty) {
    // Device is optional: Log Chat no longer asks for it. New rows without a
    // direction store NULL (shown as "—", same as legacy rows); edits keep the
    // row's saved direction.
    const kept = normalizeChatDirection(existingRow?.chatDirection ?? existingRow?.chat_direction);
    const { chat_direction: _legacy, ...rest } = record as Record<string, unknown>;
    void _legacy;
    return { ...rest, chatDirection: kept } as unknown as T;
  }
  const direction = normalizeChatDirection(raw);
  if (!direction) throw new Error("CHAT_DIRECTION_INVALID");
  const { chat_direction: _legacy, ...rest } = record as Record<string, unknown>;
  void _legacy;
  return { ...rest, chatDirection: direction } as unknown as T;
}

export function parseOutcomeFlag(
  value: unknown,
  fallback: number,
): number | null {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || (n !== 0 && n !== 1)) return null;
  return n;
}

export function withValidatedRecordOutcomes<T extends Record<string, unknown>>(
  record: T,
  existingRow?: Record<string, unknown> | null,
): T & { received: number; attempted: number; resolved: number } {
  const baseReceived = Number(existingRow?.received ?? 1);
  const baseAttempted = Number(existingRow?.attempted ?? 1);
  const baseResolved = Number(existingRow?.resolved ?? 1);
  const received = parseOutcomeFlag(record?.received, Number.isFinite(baseReceived) ? baseReceived : 1);
  const attempted = parseOutcomeFlag(record?.attempted, Number.isFinite(baseAttempted) ? baseAttempted : 1);
  const resolved = parseOutcomeFlag(record?.resolved, Number.isFinite(baseResolved) ? baseResolved : 1);
  if (received == null || attempted == null || resolved == null) {
    throw new Error("OUTCOME_FIELDS_INVALID");
  }
  if (attempted > received || resolved > attempted) {
    throw new Error("OUTCOME_ORDER_INVALID");
  }
  return { ...record, received, attempted, resolved };
}

function parseClockMinutes(value: unknown): number | null {
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

export function validateRecordTimeOrder(record: Record<string, unknown>): void {
  const firstReceive = parseClockMinutes(record?.firstReceive);
  const firstReply = parseClockMinutes(record?.firstReply);
  const clientLast = parseClockMinutes(record?.clientLastReply);
  const analystLast = parseClockMinutes(record?.analystLastReply);
  // Times are clock-only; a reply shortly after midnight counts as the next day.
  const sinceReceive = (t: number | null) =>
    firstReceive != null && t != null ? elapsedClockMins(firstReceive, t) : undefined;
  if (firstReply != null && sinceReceive(firstReply) === null) {
    throw new Error("TIME_ORDER_INVALID_FIRST_REPLY");
  }
  if (clientLast != null && sinceReceive(clientLast) === null) {
    throw new Error("TIME_ORDER_INVALID_CLIENT_LAST_REPLY");
  }
  if (analystLast != null && sinceReceive(analystLast) === null) {
    throw new Error("TIME_ORDER_INVALID_ANALYST_LAST");
  }
  if (firstReply != null && analystLast != null) {
    const replyAt = sinceReceive(firstReply);
    const lastAt = sinceReceive(analystLast);
    const outOfOrder =
      replyAt != null && lastAt != null
        ? lastAt < replyAt
        : elapsedClockMins(firstReply, analystLast) == null;
    if (outOfOrder) throw new Error("TIME_ORDER_INVALID_ANALYST_LAST");
  }
}
