"use client";

import { C } from "@/lib/design/tokens";
import { fieldLabelStyle, inputStyle } from "@/lib/styles/controls";
import CtSelect from "@/components/ui/CtSelect";
import {
  REPLY_TIMINGS,
  REPLY_TIMING_LABELS,
  normalizeReplyTiming,
  type ReplyTiming,
} from "@/lib/records/reply-timing";

const OPTIONS = [
  { value: "", label: "— Select —" },
  ...REPLY_TIMINGS.map((t) => ({ value: t, label: REPLY_TIMING_LABELS[t] })),
];

/** Field label matching neighbouring form labels. */
export function ReplyTimingLabel({ id }: { id?: string }) {
  return (
    <div id={id} style={fieldLabelStyle()}>
      Reply timing
    </div>
  );
}

/** Optional reply-timing dropdown; choosing "— Select —" clears it. */
export default function ReplyTimingSelect({
  value,
  onChange,
  compact = false,
  disabled = false,
  id,
}: {
  value: string | null | undefined;
  onChange: (value: ReplyTiming | "") => void;
  compact?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <CtSelect
      id={id}
      aria-label="Reply timing"
      openListHighlight="none"
      value={normalizeReplyTiming(value) ?? ""}
      onChange={(v) => onChange(normalizeReplyTiming(v) ?? "")}
      options={OPTIONS}
      placeholder="— Select —"
      disabled={disabled}
      triggerStyle={inputStyle({
        cursor: disabled ? "default" : "pointer",
        minHeight: compact ? 32 : 42,
        padding: compact ? "4px 10px" : undefined,
        fontSize: compact ? 12 : 13,
        width: "100%",
        minWidth: compact ? 168 : undefined,
        maxWidth: compact ? 260 : undefined,
      })}
    />
  );
}

/** Read-only label for tables and detail views; grey dash when not set. */
export function ReplyTimingText({ value }: { value: string | null | undefined }) {
  const t = normalizeReplyTiming(value);
  if (!t) return <span style={{ color: C.muted }}>—</span>;
  const label = REPLY_TIMING_LABELS[t];
  return (
    <span title={label} style={{ whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}
