"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type LogTimeUnitOption = { value: string; label: string };

export default function LogTimeUnitSelect({
  value,
  onChange,
  options,
  placeholder = "—",
  kind,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: LogTimeUnitOption[];
  placeholder?: string;
  kind: "hour" | "minute";
  "aria-label"?: string;
}) {
  const genId = useId();
  const listId = `${genId}-listbox`;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const normValue = value == null ? "" : String(value);
  const selected = options.find((o) => o.value === normValue);
  const display = selected?.label ?? "";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const openMenu = () => {
    const idx = options.findIndex((o) => o.value === normValue);
    setHighlight(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const toggle = () => {
    setOpen((prev) => {
      if (prev) return false;
      openMenu();
      return true;
    });
  };

  const pick = (opt: LogTimeUnitOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyTrigger = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) openMenu();
    }
  };

  const onKeyList = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(options.length - 1, h < 0 ? 0 : h + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, (h < 0 ? 0 : h) - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt) pick(opt);
    }
  };

  useEffect(() => {
    if (!open || highlight < 0) return;
    optionsRef.current[highlight]?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  return (
    <div
      ref={rootRef}
      className={`ct-log-time-dd ct-log-time-dd--${kind}${open ? " ct-log-time-dd--open" : ""}${display ? " ct-log-time-dd--filled" : ""}`}
    >
      <button
        type="button"
        className="ct-log-time-dd__trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onKeyDown={onKeyTrigger}
        onClick={toggle}
      >
        <span className="ct-log-time-dd__value">
          {display || <span className="ct-log-time-dd__placeholder">{placeholder}</span>}
        </span>
        <ChevronDown size={13} strokeWidth={2.25} aria-hidden className="ct-log-time-dd__chev" />
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          tabIndex={-1}
          className={`ct-log-time-dd__menu${kind === "minute" ? " ct-log-time-dd__menu--grid" : ""}`}
          onKeyDown={onKeyList}
        >
          {options.map((opt, i) => {
            const sel = opt.value === normValue;
            const hi = i === highlight;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={sel}
                ref={(n) => {
                  optionsRef.current[i] = n;
                }}
                className={`ct-log-time-dd__option${sel ? " ct-log-time-dd__option--selected" : ""}${hi ? " ct-log-time-dd__option--highlight" : ""}`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => pick(opt)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
