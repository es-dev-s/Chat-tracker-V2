import type { ReplyTiming } from "@/lib/records/reply-timing";

/**
 * Reply-timing values the user picked that the server has not confirmed yet.
 * Background refreshes and realtime echoes must not paint over these, or the
 * cell would flicker back to an older value while a save is in flight.
 */
const pending = new Map<number, ReplyTiming | null>();

export function setPendingReplyTiming(id: number, value: ReplyTiming | null): void {
  pending.set(id, value);
}

export function clearPendingReplyTiming(id: number): void {
  pending.delete(id);
}

export function hasPendingReplyTiming(id: number): boolean {
  return pending.has(id);
}

/** Re-apply in-flight picks on top of a freshly fetched record list. */
export function overlayPendingReplyTimings<T extends { id: number; replyTiming?: ReplyTiming | null }>(
  records: T[],
): T[] {
  if (pending.size === 0) return records;
  return records.map((r) => (pending.has(r.id) ? { ...r, replyTiming: pending.get(r.id) ?? null } : r));
}
