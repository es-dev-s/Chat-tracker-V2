"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import CtSelect from "@/components/ui/CtSelect";
import {
  REPLY_TIMINGS,
  REPLY_TIMING_LABELS,
  normalizeReplyTiming,
  type ReplyTiming,
} from "@/lib/records/reply-timing";
import { formatStoredTimeDisplay } from "@/lib/utils/time-input";
import { elapsedClockMins, fmtMins, parseTime } from "@/lib/utils/format-duration";

export type Tone = { fg: string; bg: string; border: string };
export const NEUTRAL_TONE: Tone = { fg: "#5b6172", bg: "#f5f6f9", border: "#dfe3ea" };
export const CATEGORY_TONE: Record<ReplyTiming, Tone> = {
  same_day: { fg: "#1e7b3c", bg: "#e9f7ee", border: "#bfe5cb" },
  next_morning: { fg: "#8a5a00", bg: "#fdf4de", border: "#f2dca3" },
  after_12pm_next_day: { fg: "#b42318", bg: "#fdecea", border: "#f6c4c0" },
  main_cases: { fg: "#1f4fbf", bg: "#eaf1fe", border: "#c4d6fb" },
  sunday_only: { fg: "#5b3fb0", bg: "#f1ecfd", border: "#d8cdf6" },
};

export const CATEGORY_OPTIONS = [
  { value: "", label: "Not set" },
  ...REPLY_TIMINGS.map((t) => ({ value: t, label: REPLY_TIMING_LABELS[t] })),
];

export const FILTER_TRIGGER = {
  width: "100%",
  height: 38,
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 10,
  border: "1px solid #dfe5ee",
  background: "#ffffff",
  fontSize: 13,
  fontWeight: 500,
  color: "#1c2333",
  boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
} as const;

export type SaveState = "saving" | "saved" | "error";

export function timeOrDash(value: string): string {
  return String(value ?? "").trim() ? formatStoredTimeDisplay(value) : "—";
}

/** "12 min", "1h 5m"; null when either time is missing or out of order. */
export function replyGapLabel(received: string, reply: string): string | null {
  const mins = elapsedClockMins(parseTime(received), parseTime(reply));
  return mins == null ? null : fmtMins(Math.round(mins));
}

export function Dash() {
  return <span className="ct-wa-muted">—</span>;
}

export function CategoryPill({ value }: { value: ReplyTiming | null | undefined }) {
  const t = normalizeReplyTiming(value);
  const tone = t ? CATEGORY_TONE[t] : NEUTRAL_TONE;
  return (
    <span
      className="ct-wa-pill"
      style={{ color: tone.fg, background: tone.bg, borderColor: tone.border }}
      title={t ? REPLY_TIMING_LABELS[t] : "Not set"}
    >
      {t ? REPLY_TIMING_LABELS[t] : "Not set"}
    </span>
  );
}

export function CategoryPicker({
  value,
  state,
  disabled,
  onChange,
}: {
  value: ReplyTiming | null;
  state: SaveState | undefined;
  disabled?: boolean;
  onChange: (next: ReplyTiming | null) => void;
}) {
  const timing = normalizeReplyTiming(value);
  const tone = timing ? CATEGORY_TONE[timing] : NEUTRAL_TONE;
  return (
    <div className="ct-wa-cat">
      <CtSelect
        aria-label="Category"
        openListHighlight="none"
        searchable={false}
        disabled={disabled}
        value={timing ?? ""}
        options={CATEGORY_OPTIONS}
        onChange={(v) => onChange(normalizeReplyTiming(v))}
        getOptionStyle={(opt) => {
          const t = normalizeReplyTiming(opt.value);
          return t ? { color: CATEGORY_TONE[t].fg, fontWeight: 600 } : undefined;
        }}
        triggerStyle={{
          width: "100%",
          minHeight: 30,
          height: 30,
          padding: "0 10px 0 12px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          color: tone.fg,
          background: tone.bg,
          border: `1px solid ${tone.border}`,
          boxShadow: "none",
          cursor: disabled ? "default" : "pointer",
        }}
      />
      <span className="ct-wa-cat__status" aria-live="polite">
        {state === "saving" ? (
          <Loader2 size={14} className="ct-wa-spin" aria-label="Saving" />
        ) : state === "saved" ? (
          <Check size={14} className="ct-wa-ok" aria-label="Saved" />
        ) : state === "error" ? (
          <AlertCircle size={14} className="ct-wa-err" aria-label="Not saved" />
        ) : null}
      </span>
    </div>
  );
}
