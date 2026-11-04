/** Optional "Reply timing" category on Log Chat. Stored as `reply_timing`. */
export const REPLY_TIMINGS = [
  "same_day",
  "next_morning",
  "after_12pm_next_day",
  "main_cases",
  "sunday_only",
  "left_as_seen",
] as const;

export type ReplyTiming = (typeof REPLY_TIMINGS)[number];

export const REPLY_TIMING_LABELS: Record<ReplyTiming, string> = {
  same_day: "Replied on the same day",
  next_morning: "Replied the next morning",
  after_12pm_next_day: "No reply until 12 PM the next day",
  main_cases: "Responses to main cases",
  sunday_only: "Replied only on Sunday",
  left_as_seen: "Left as seen",
};

export function isReplyTiming(value: unknown): value is ReplyTiming {
  return (REPLY_TIMINGS as readonly string[]).includes(String(value));
}

/** Trims / lower-cases; returns null for empty or unknown values. */
export function normalizeReplyTiming(value: unknown): ReplyTiming | null {
  const v = String(value ?? "").trim().toLowerCase();
  return isReplyTiming(v) ? v : null;
}

/** Human label, or an em dash when not set. */
export function replyTimingLabel(value: unknown): string {
  const t = normalizeReplyTiming(value);
  return t ? REPLY_TIMING_LABELS[t] : "—";
}
