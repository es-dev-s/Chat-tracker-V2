"use client";

import { useId, type ReactNode } from "react";
import { C, RAD } from "@/lib/design/tokens";

type CtCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
};

/** Accessible custom checkbox; keeps native input for form semantics, hides it visually. */
export default function CtCheckbox({
  checked,
  onChange,
  disabled = false,
  children,
}: CtCheckboxProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        color: C.label,
        fontSize: 12,
        userSelect: "none",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          position: "absolute",
          opacity: 0,
          width: 1,
          height: 1,
          margin: -1,
          clip: "rect(0 0 0 0)",
        }}
      />
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 18,
          height: 18,
          borderRadius: RAD.sm,
          border: `1.5px solid ${disabled ? C.dim : checked ? C.accent : C.border}`,
          background: checked ? "rgba(37,99,235,0.12)" : C.surface,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "border-color 0.15s ease, background 0.15s ease",
          boxShadow: checked ? `inset 0 0 0 1px ${C.accent}33` : "none",
        }}
      >
        {checked ? (
          <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden>
            <path
              d="M1 4.5L4 7.5L10 1"
              stroke={C.accent}
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      {children}
    </label>
  );
}
