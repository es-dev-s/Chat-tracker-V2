"use client";

import { MONO } from "@/lib/design/tokens";
import { inputStyle } from "@/lib/styles/controls";

type OutcomeKey = "received" | "attempted" | "resolved";

export default function LogOutcomeField({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="ct-log-outcome-field">
      <label className="ct-log-outcome-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="ct-log-outcome-field__input"
        style={inputStyle({ fontFamily: MONO, minHeight: 42, textAlign: "center" })}
        type="number"
        inputMode="numeric"
        min={0}
        max={1}
        step={1}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(0);
            return;
          }
          const n = Number(raw);
          if (!Number.isFinite(n)) return;
          onChange(n >= 1 ? 1 : 0);
        }}
        aria-label={label}
      />
    </div>
  );
}

export type { OutcomeKey };
