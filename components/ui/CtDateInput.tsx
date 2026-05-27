"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { C, RAD } from "@/lib/design/tokens";
import { isValidIsoDateString, parseIsoDateParts } from "@/lib/utils/date-iso";
import { inputStyle } from "@/lib/styles/controls";
import type { CSSProperties } from "react";

const POPOVER_MIN_W = 272;
const POPOVER_MAX_W = 336;
const POPOVER_ESTIMATE_H = 300;
const VIEWPORT_MARGIN = 12;
const POPOVER_GAP = 6;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m0: number, day: number): string {
  return `${y}-${pad2(m0 + 1)}-${pad2(day)}`;
}

type PopoverPlacement = "above" | "below";

type PopoverCoords = {
  top: number;
  left: number;
  width: number;
  placement: PopoverPlacement;
};

function computePopoverCoords(
  anchor: DOMRect,
  popoverHeight: number,
  popoverWidth: number,
): PopoverCoords {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(popoverWidth, vw - VIEWPORT_MARGIN * 2);

  const spaceBelow = vh - anchor.bottom - VIEWPORT_MARGIN;
  const spaceAbove = anchor.top - VIEWPORT_MARGIN;
  const fitsBelow = spaceBelow >= popoverHeight + POPOVER_GAP;
  const fitsAbove = spaceAbove >= popoverHeight + POPOVER_GAP;
  let placement: PopoverPlacement = "below";
  if (!fitsBelow && (fitsAbove || spaceAbove > spaceBelow)) {
    placement = "above";
  }

  let top =
    placement === "below"
      ? anchor.bottom + POPOVER_GAP
      : anchor.top - POPOVER_GAP - popoverHeight;
  top = Math.max(
    VIEWPORT_MARGIN,
    Math.min(top, vh - popoverHeight - VIEWPORT_MARGIN),
  );

  let left = anchor.left;
  if (left + width > vw - VIEWPORT_MARGIN) {
    left = Math.max(VIEWPORT_MARGIN, anchor.right - width);
  }
  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;

  return { top, left, width, placement };
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
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [popoverCoords, setPopoverCoords] = useState<PopoverCoords | null>(null);
  const [cursorMonth, setCursorMonth] = useState(() => {
    const p = parseIsoDateParts(value || "");
    const now = new Date();
    return p ? new Date(p.y, p.m, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  const updatePopoverPosition = useCallback(() => {
    const anchor = triggerRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const preferredWidth = Math.min(
      POPOVER_MAX_W,
      Math.max(POPOVER_MIN_W, rect.width),
    );
    const measuredH = popoverRef.current?.offsetHeight ?? POPOVER_ESTIMATE_H;
    setPopoverCoords(
      computePopoverCoords(rect, measuredH, preferredWidth),
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverCoords(null);
      return;
    }
    triggerRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
    updatePopoverPosition();
    const raf = window.requestAnimationFrame(() => updatePopoverPosition());
    return () => window.cancelAnimationFrame(raf);
  }, [open, cursorMonth, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePopoverPosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
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

  const calendarPopover =
    open && popoverCoords && mounted ? (
      <div
        ref={popoverRef}
        className={`ct-date-input__popover ct-date-input__popover--${popoverCoords.placement}`}
        role="dialog"
        aria-label="Choose date"
        style={{
          top: popoverCoords.top,
          left: popoverCoords.left,
          width: popoverCoords.width,
        }}
      >
        <div className="ct-date-input__popover-nav">
          <button
            type="button"
            aria-label="Previous month"
            className="ct-date-input__popover-nav-btn"
            onClick={() => setCursorMonth(new Date(cy, cm - 1, 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="ct-date-input__popover-title">
            {cursorMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>
          <button
            type="button"
            aria-label="Next month"
            className="ct-date-input__popover-nav-btn"
            onClick={() => setCursorMonth(new Date(cy, cm + 1, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="ct-date-input__popover-weekdays" aria-hidden>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="ct-date-input__popover-grid">
          {cells.map((day, idx) =>
            day == null ? (
              <div key={`e-${idx}`} />
            ) : (
              <button
                key={day}
                type="button"
                className={`ct-date-input__popover-day${toIso(cy, cm, day) === value ? " ct-date-input__popover-day--selected" : ""}`}
                onClick={() => pickDay(day)}
              >
                {day}
              </button>
            ),
          )}
        </div>
      </div>
    ) : null;

  return (
    <div
      ref={rootRef}
      className={[
        compact ? "ct-date-input ct-date-input--compact" : "ct-date-input",
        open ? "ct-date-input--open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ position: "relative", width: "100%" }}
    >
      <div
        ref={triggerRef}
        className="ct-date-input__trigger"
        style={
          compact
            ? { position: "relative", width: "100%" }
            : { display: "flex", gap: 6, alignItems: "center" }
        }
      >
        <input
          id={inputId}
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-haspopup="dialog"
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
            if (e.key === "Escape") setOpen(false);
          }}
        />
        <button
          type="button"
          aria-label="Open calendar"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          style={calendarBtnStyle}
        >
          <Calendar size={compact ? 14 : 18} strokeWidth={2} aria-hidden />
        </button>
      </div>
      {mounted && calendarPopover
        ? createPortal(calendarPopover, document.body)
        : null}
    </div>
  );
}
