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
  if (firstReceive != null && firstReply != null && firstReply < firstReceive) {
    throw new Error("TIME_ORDER_INVALID_FIRST_REPLY");
  }
  if (firstReceive != null && clientLast != null && clientLast < firstReceive) {
    throw new Error("TIME_ORDER_INVALID_CLIENT_LAST_REPLY");
  }
  if (firstReceive != null && analystLast != null && analystLast < firstReceive) {
    throw new Error("TIME_ORDER_INVALID_ANALYST_LAST");
  }
  if (firstReply != null && analystLast != null && analystLast < firstReply) {
    throw new Error("TIME_ORDER_INVALID_ANALYST_LAST");
  }
}
