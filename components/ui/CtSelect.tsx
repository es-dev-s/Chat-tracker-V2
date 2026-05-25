"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { RAD } from "@/lib/design/tokens";
import type { CSSProperties } from "react";

export type CtSelectOption = { value: string; label?: string };

type CtSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: (string | CtSelectOption)[];
  placeholder?: string;
  disabled?: boolean;
  triggerStyle?: CSSProperties;
  triggerClassName?: string;
  getOptionStyle?: (opt: CtSelectOption) => CSSProperties | undefined;
  id?: string;
  "aria-label"?: string;
  openListHighlight?: "first-match" | "none";
};

/** Custom single-select (replaces native HTML select). Same value/onChange contract: string values. */
export default function CtSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  triggerStyle = {},
  triggerClassName,
  getOptionStyle,
  id: idProp,
  "aria-label": ariaLabel,
  openListHighlight = "first-match",
}: CtSelectProps) {
  const genId = useId();
  const baseId = idProp || genId;
  const listId = `${baseId}-listbox`;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const suppressScrollIntoViewRef = useRef(false);

  const normValue = value == null ? "" : String(value);

  const flat = useMemo(
    () =>
      Array.isArray(options)
        ? options.map((o) => (typeof o === "string" ? { value: o, label: o } : { ...o }))
        : [],
    [options],
  );

  const selected = flat.find((o) => String(o.value) === normValue);
  const display = selected ? (selected.label ?? String(selected.value)) : "";

  useEffect(() => {
    if (!open) return;
    const el = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", el);
    return () => document.removeEventListener("mousedown", el);
  }, [open]);

  useEffect(() => {
    if (open) suppressScrollIntoViewRef.current = true;
  }, [open]);

  const applyOpenHighlight = () => {
    if (openListHighlight === "none") {
      setHighlight(-1);
      return;
    }
    const idx = flat.findIndex((o) => String(o.value) === normValue);
    setHighlight(idx >= 0 ? idx : 0);
  };

  const openMenu = () => {
    if (disabled) return;
    applyOpenHighlight();
    setOpen(true);
  };

  const toggleMenu = () => {
    if (disabled) return;
    setOpen((s) => {
      if (!s) {
        applyOpenHighlight();
        return true;
      }
      return false;
    });
  };

  const pick = (opt: CtSelectOption) => {
    onChange(String(opt.value));
    setOpen(false);
  };

  const onKeyTrigger = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
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
      setHighlight((h) => Math.min(flat.length - 1, h < 0 ? 0 : h + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, (h < 0 ? 0 : h) - 1));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setHighlight(flat.length - 1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = flat[highlight];
      if (opt) pick(opt);
    }
  };

  useEffect(() => {
    if (!open || highlight < 0) return;
    if (suppressScrollIntoViewRef.current) {
      suppressScrollIntoViewRef.current = false;
      return;
    }
    const node = optionsRef.current[highlight];
    node?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        id={baseId}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        className={triggerClassName}
        onKeyDown={onKeyTrigger}
        onClick={toggleMenu}
        style={{
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          textAlign: "left",
          ...triggerStyle,
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {display || <span style={{ opacity: 0.55 }}>{placeholder}</span>}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          style={{
            flexShrink: 0,
            opacity: 0.55,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s ease",
          }}
        />
      </button>
      {open && !disabled ? (
        <div
          id={listId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onKeyList}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 9500,
            maxHeight: "min(280px, 42vh)",
            overflowY: "auto",
            borderRadius: RAD.md,
            border:
              typeof triggerStyle.border === "string"
                ? triggerStyle.border
                : "1px solid #d9e7ff",
            background:
              typeof triggerStyle.background === "string"
                ? triggerStyle.background
                : "#ffffff",
            boxShadow: "0 14px 36px rgba(15,23,42,0.12)",
            padding: 4,
          }}
        >
          {flat.map((opt, i) => {
            const sel = String(opt.value) === normValue;
            const hi = i === highlight;
            const extra = getOptionStyle ? getOptionStyle(opt) : undefined;
            return (
              <button
                key={`${String(opt.value)}-${i}`}
                type="button"
                role="option"
                aria-selected={sel}
                ref={(n) => {
                  optionsRef.current[i] = n;
                }}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={() => pick(opt)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 11px",
                  border: "none",
                  borderRadius: RAD.sm,
                  background: hi ? "rgba(37,99,235,0.1)" : "transparent",
                  fontSize:
                    typeof triggerStyle.fontSize === "number" ? triggerStyle.fontSize : 13,
                  fontWeight: sel ? 600 : 500,
                  cursor: "pointer",
                  color: "#111827",
                  ...extra,
                }}
              >
                {opt.label ?? String(opt.value)}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
