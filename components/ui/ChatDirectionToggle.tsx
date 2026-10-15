"use client";

import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { LogIn, LogOut } from "lucide-react";
import { C, RAD, SANS } from "@/lib/design/tokens";
import { fieldLabelStyle, inputStyle } from "@/lib/styles/controls";
import {
  CHAT_DIRECTIONS,
  CHAT_DIRECTION_LABELS,
  normalizeChatDirection,
  type ChatDirection,
} from "@/lib/records/chat-direction";

/*
 * Styled with the same inline style helpers as the neighbouring Log Chat
 * inputs (inputStyle / fieldLabelStyle), so layout never depends on global
 * CSS being compiled. Focus-visible uses the global `button:focus-visible`
 * ring; `.ct-direction-toggle__btn` in globals.css tightens its offset.
 */

const ICONS = { in: LogIn, out: LogOut } as const;

const ACCENT_SOFT = "rgba(37, 99, 235, 0.08)";
const ACCENT_RING = "rgba(37, 99, 235, 0.22)";

type Props = {
  id?: string;
  value: string | null | undefined;
  onChange: (value: ChatDirection) => void;
  invalid?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

/** Segmented In / Out control (radiogroup semantics, arrow-key navigation). */
export default function ChatDirectionToggle({
  id,
  value,
  onChange,
  invalid = false,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: Props) {
  const current = normalizeChatDirection(value);
  const [hovered, setHovered] = useState<ChatDirection | null>(null);

  const select = (d: ChatDirection, focus?: HTMLElement | null) => {
    if (disabled) return;
    onChange(d);
    focus?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next: ChatDirection = current === "in" ? "out" : "in";
    const group = e.currentTarget.parentElement;
    select(next, group?.querySelector<HTMLButtonElement>(`[data-direction="${next}"]`));
  };

  const groupStyle = inputStyle({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 4,
    padding: 3,
    minHeight: 42,
    borderColor: invalid ? C.red : C.border,
    boxShadow: invalid ? "0 0 0 3px rgba(220, 38, 38, 0.10)" : undefined,
    opacity: disabled ? 0.6 : 1,
  });

  return (
    <div
      id={id}
      className="ct-direction-toggle"
      role="radiogroup"
      aria-label={ariaLabelledBy ? undefined : ariaLabel ?? "Device"}
      aria-labelledby={ariaLabelledBy}
      aria-required="true"
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedBy}
      style={groupStyle}
    >
      {CHAT_DIRECTIONS.map((d, index) => {
        const Icon = ICONS[d];
        const active = current === d;
        const hover = !active && hovered === d && !disabled;
        const tabbable = active || (current == null && index === 0);
        const btn: CSSProperties = {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          minWidth: 0,
          height: 34,
          margin: 0,
          padding: "0 12px",
          border: "none",
          borderRadius: RAD.sm - 1,
          background: active ? ACCENT_SOFT : hover ? C.card2 : "transparent",
          boxShadow: active ? `inset 0 0 0 1px ${ACCENT_RING}` : "none",
          color: active ? C.accent : hover ? C.label : C.muted,
          fontFamily: SANS,
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1,
          whiteSpace: "nowrap",
          cursor: disabled ? "default" : "pointer",
          transition: "background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
        };
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={active}
            data-direction={d}
            data-active={active}
            tabIndex={tabbable ? 0 : -1}
            disabled={disabled}
            className="ct-direction-toggle__btn"
            style={btn}
            onClick={() => select(d)}
            onKeyDown={onKeyDown}
            onMouseEnter={() => setHovered(d)}
            onMouseLeave={() => setHovered((h) => (h === d ? null : h))}
          >
            <Icon size={15} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0 }} />
            <span>{CHAT_DIRECTION_LABELS[d]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Field label matching Log Chat labels; `required` adds the red asterisk. */
export function ChatDirectionLabel({
  id,
  required = false,
}: {
  id?: string;
  required?: boolean;
}) {
  return (
    <div id={id} style={fieldLabelStyle()}>
      Device
      {required ? (
        <span aria-hidden style={{ color: C.red }}>
          {" *"}
        </span>
      ) : null}
    </div>
  );
}

/** Compact read-only pill for tables and detail views; dash for legacy rows. */
export function ChatDirectionBadge({ value }: { value: string | null | undefined }) {
  const d = normalizeChatDirection(value);
  if (!d) return <span style={{ color: C.muted }}>—</span>;
  const Icon = ICONS[d];
  const tone =
    d === "in"
      ? { color: "#047857", background: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.22)" }
      : { color: C.accent, background: ACCENT_SOFT, border: ACCENT_RING };
  return (
    <span
      className="ct-direction-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        fontFamily: SANS,
        fontSize: 11.5,
        fontWeight: 600,
        lineHeight: "18px",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={12} strokeWidth={2.4} aria-hidden style={{ flexShrink: 0 }} />
      {CHAT_DIRECTION_LABELS[d]}
    </span>
  );
}
