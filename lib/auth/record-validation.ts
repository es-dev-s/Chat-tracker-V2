import { parseEventEpochMinutes, resolveEventDate } from "@/lib/utils/event-datetime";

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

function eventEpoch(
  record: Record<string, unknown>,
  timeKey: string,
  dateKey: string,
): number | null {
  const time = String(record[timeKey] ?? "").trim();
  if (!time) return null;
  const recordDate = String(record.date ?? "").trim();
  const dateIso = resolveEventDate(String(record[dateKey] ?? ""), recordDate);
  return parseEventEpochMinutes(dateIso, time);
}

export function validateRecordTimeOrder(record: Record<string, unknown>): void {
  const receive = eventEpoch(record, "firstReceive", "firstReceiveDate");
  const firstReply = eventEpoch(record, "firstReply", "firstReplyDate");
  const clientLast = eventEpoch(record, "clientLastReply", "clientLastReplyDate");
  const analystLast = eventEpoch(record, "analystLastReply", "analystLastReplyDate");

  if (receive != null && firstReply != null && firstReply < receive) {
    throw new Error("TIME_ORDER_INVALID_FIRST_REPLY");
  }
  if (receive != null && clientLast != null && clientLast < receive) {
    throw new Error("TIME_ORDER_INVALID_CLIENT_LAST_REPLY");
  }
  if (receive != null && analystLast != null && analystLast < receive) {
    throw new Error("TIME_ORDER_INVALID_ANALYST_LAST");
  }
  if (firstReply != null && analystLast != null && analystLast < firstReply) {
    throw new Error("TIME_ORDER_INVALID_ANALYST_LAST");
  }
}
