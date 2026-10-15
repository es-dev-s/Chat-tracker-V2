/** Chat direction captured on Log Chat. Stored as `chat_direction` ('in' | 'out'). */
export const CHAT_DIRECTIONS = ["in", "out"] as const;

export type ChatDirection = (typeof CHAT_DIRECTIONS)[number];

export const CHAT_DIRECTION_LABELS: Record<ChatDirection, string> = {
  in: "In",
  out: "Out",
};

export function isChatDirection(value: unknown): value is ChatDirection {
  return value === "in" || value === "out";
}

/** Lower-cases and trims; returns null for empty / unknown values. */
export function normalizeChatDirection(value: unknown): ChatDirection | null {
  const v = String(value ?? "").trim().toLowerCase();
  return isChatDirection(v) ? v : null;
}

/** Display label, or an em dash for legacy rows without a direction. */
export function chatDirectionLabel(value: unknown): string {
  const d = normalizeChatDirection(value);
  return d ? CHAT_DIRECTION_LABELS[d] : "—";
}
