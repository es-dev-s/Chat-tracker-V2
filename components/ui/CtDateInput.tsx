"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { C, RAD } from "@/lib/design/tokens";
import { isValidIsoDateString, parseIsoDateParts } from "@/lib/utils/date-iso";
import { inputStyle } from "@/lib/styles/controls";
import type { CSSProperties } from "react";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m0: number, day: number): string {
  return `${y}-${pad2(m0 + 1)}-${pad2(day)}`;
}

type CtDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  inputStyleFn?: (extra?: CSSProperties) => CSSProperties;
  compact?: boolean;
  id?: string;
  "aria-label"?: string;
};

/** YYYY-MM-DD with typing + calendar. Remount via `key` when controlled value changes from outside. */
export default function CtDateInput({
  value,
  onChange,
  inputStyleFn = inputStyle,
  compact = false,
  id: idProp,
  "aria-label": ariaLabel = "Date",
}: CtDateInputProps) {
  const wrapId = useId();
  const inputId = idProp || wrapId;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [cursorMonth, setCursorMonth] = useState(() => {
    const p = parseIsoDateParts(value || "");
    const now = new Date();
    return p ? new Date(p.y, p.m, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const el = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", el);
    return () => document.removeEventListener("mousedown", el);
  }, [open]);

  const commitDraft = () => {
    const t = draft.trim();
    if (t === "") {
      onChange("");
      return;
    }
    if (isValidIsoDateString(t)) onChange(t);
    else setDraft(value || "");
  };

  const baseInput = inputStyleFn({
    paddingRight: compact ? 34 : 40,
    fontVariantNumeric: "tabular-nums",
    ...(compact
      ? {
          minHeight: 34,
          padding: "7px 34px 7px 10px",
          fontSize: 12.5,
          fontWeight: 500,
          borderRadius: RAD.sm,
        }
      : {}),
  });

  const calendarBtnStyle: CSSProperties = compact
    ? {
        position: "absolute",
        right: 4,
        top: "50%",
        transform: "translateY(-50%)",
        width: 26,
        height: 26,
        borderRadius: 6,
        border: "none",
        background: open ? "rgba(37,99,235,0.1)" : "transparent",
        color: C.accent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "background-color 0.14s ease",
      }
    : {
        flexShrink: 0,
        width: 38,
        height: 38,
        borderRadius: RAD.sm,
        border: `1px solid ${C.border}`,
        background: C.surface,
        color: C.accent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      };

  const cy = cursorMonth.getFullYear();
  const cm = cursorMonth.getMonth();
  const firstDow = new Date(cy, cm, 1).getDay();
  const daysInMonth = new Date(cy, cm + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const pickDay = (day: number) => {
    const iso = toIso(cy, cm, day);
    onChange(iso);
    setDraft(iso);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={compact ? "ct-date-input ct-date-input--compact" : undefined}
      style={{ position: "relative", width: "100%" }}
    >
      <div
        style={
          compact
            ? { position: "relative", width: "100%" }
            : { display: "flex", gap: 6, alignItems: "center" }
        }
      >
        <input
          id={inputId}
          aria-label={ariaLabel}
          className={compact ? "ct-input ct-date-input__field" : undefined}
          style={{ ...baseInput, flex: 1, minWidth: compact ? 0 : 120, width: "100%" }}
          value={draft}
          placeholder="YYYY-MM-DD"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            }
          }}
        />
        <button
          type="button"
          aria-label="Open calendar"
          onClick={() => setOpen((o) => !o)}
          style={calendarBtnStyle}
        >
          <Calendar size={compact ? 14 : 18} strokeWidth={2} aria-hidden />
        </button>
      </div>
      {open ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "calc(100% + 6px)",
            zIndex: 9500,
            width: "min(100%, 336px)",
            minWidth: 272,
            maxWidth: "calc(100vw - 32px)",
            padding: 12,
            borderRadius: RAD.md,
            border: `1px solid ${C.border}`,
            background: C.surface,
            boxShadow: "0 14px 36px rgba(15,23,42,0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursorMonth(new Date(cy, cm - 1, 1))}
              style={{
                border: "none",
                background: "transparent",
                padding: 6,
                cursor: "pointer",
                color: C.text,
                borderRadius: RAD.sm,
              }}
            >
              <ChevronLeft size={18} />
            </button>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
              {cursorMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </div>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursorMonth(new Date(cy, cm + 1, 1))}
              style={{
                border: "none",
                background: "transparent",
                padding: 6,
                cursor: "pointer",
                color: C.text,
                borderRadius: RAD.sm,
              }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 2,
              textAlign: "center",
              fontSize: 10,
              fontWeight: 600,
              color: C.muted,
              marginBottom: 6,
            }}
          >
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {cells.map((day, idx) =>
              day == null ? (
                <div key={`e-${idx}`} />
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => pickDay(day)}
                  style={{
                    border: "none",
                    borderRadius: RAD.sm,
                    padding: "7px 0",
                    fontSize: 12,
                    fontWeight: toIso(cy, cm, day) === value ? 700 : 500,
                    cursor: "pointer",
                    background:
                      toIso(cy, cm, day) === value ? "rgba(37,99,235,0.18)" : "transparent",
                    color: C.text,
                  }}
                >
                  {day}
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
