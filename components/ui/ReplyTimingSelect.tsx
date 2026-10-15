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

/** Field label matching the other Log Chat labels. */
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
}: {
  value: string | null | undefined;
  onChange: (value: ReplyTiming | "") => void;
}) {
  return (
    <CtSelect
      aria-label="Reply timing"
      openListHighlight="none"
      value={normalizeReplyTiming(value) ?? ""}
      onChange={(v) => onChange(normalizeReplyTiming(v) ?? "")}
      options={OPTIONS}
      placeholder="— Select —"
      triggerStyle={inputStyle({ cursor: "pointer", minHeight: 42 })}
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
