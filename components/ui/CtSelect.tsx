"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { RAD, SANS } from "@/lib/design/tokens";
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
  /** Show a search field in the menu (recommended for long lists). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Auto-enable search when option count is at or above this (ignored if searchable is set). */
  searchThreshold?: number;
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
  searchable,
  searchPlaceholder,
  searchThreshold = 8,
}: CtSelectProps) {
  const genId = useId();
  const baseId = idProp || genId;
  const listId = `${baseId}-listbox`;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
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

  const showSearch =
    searchable === true || (searchable !== false && flat.length >= searchThreshold);

  const filtered = useMemo(() => {
    if (!showSearch) return flat;
    const q = query.trim().toLowerCase();
    if (!q) return flat;
    return flat.filter((o) => {
      const label = (o.label ?? String(o.value)).toLowerCase();
      return label.includes(q) || String(o.value).toLowerCase().includes(q);
    });
  }, [flat, query, showSearch]);

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
    if (!open) {
      setQuery("");
      return;
    }
    suppressScrollIntoViewRef.current = true;
    if (showSearch) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
  }, [open, showSearch]);

  const openMenu = () => {
    if (disabled) return;
    setQuery("");
    const list = flat;
    if (openListHighlight === "none") setHighlight(-1);
    else {
      const idx = list.findIndex((o) => String(o.value) === normValue);
      setHighlight(idx >= 0 ? idx : list.length ? 0 : -1);
    }
    setOpen(true);
  };

  const toggleMenu = () => {
    if (disabled) return;
    setOpen((s) => {
      if (!s) {
        setQuery("");
        const list = flat;
        if (openListHighlight === "none") setHighlight(-1);
        else {
          const idx = list.findIndex((o) => String(o.value) === normValue);
          setHighlight(idx >= 0 ? idx : list.length ? 0 : -1);
        }
        return true;
      }
      return false;
    });
  };

  const pick = (opt: CtSelectOption) => {
    onChange(String(opt.value));
    setOpen(false);
    setQuery("");
  };

  const onKeyTrigger = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu();
    }
  };

  const moveHighlight = (delta: number) => {
    if (!filtered.length) {
      setHighlight(-1);
      return;
    }
    setHighlight((h) => {
      const base = h < 0 ? (delta > 0 ? -1 : 0) : h;
      const next = Math.min(filtered.length - 1, Math.max(0, base + delta));
      return next;
    });
  };

  const onKeyList = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setHighlight(filtered.length ? 0 : -1);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setHighlight(filtered.length ? filtered.length - 1 : -1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt);
    }
  };

  useEffect(() => {
    if (!open) return;
    // Keep highlight valid while filtering.
    if (!filtered.length) {
      setHighlight(-1);
      return;
    }
    setHighlight((h) => {
      if (h < 0) return openListHighlight === "none" ? -1 : 0;
      return Math.min(h, filtered.length - 1);
    });
  }, [filtered, open, openListHighlight]);

  useEffect(() => {
    if (!open || highlight < 0) return;
    if (suppressScrollIntoViewRef.current) {
      suppressScrollIntoViewRef.current = false;
      return;
    }
    const node = optionsRef.current[highlight];
    node?.scrollIntoView({ block: "nearest" });
  }, [open, highlight, filtered]);

  const borderColor =
    typeof triggerStyle.border === "string" ? triggerStyle.border : "1px solid #d9e7ff";
  const menuBg =
    typeof triggerStyle.background === "string" ? triggerStyle.background : "#ffffff";
  const fontSize =
    typeof triggerStyle.fontSize === "number" ? triggerStyle.fontSize : 13;

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
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 9500,
            borderRadius: RAD.md,
            border: borderColor,
            background: menuBg,
            boxShadow: "0 14px 36px rgba(15,23,42,0.12)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "min(320px, 48vh)",
          }}
        >
          {showSearch ? (
            <div
              style={{
                position: "relative",
                flexShrink: 0,
                padding: "8px 8px 6px",
                borderBottom: "1px solid rgba(226, 234, 244, 0.88)",
              }}
            >
              <Search
                size={14}
                strokeWidth={2.15}
                aria-hidden
                style={{
                  position: "absolute",
                  left: 18,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#64748b",
                  opacity: 0.65,
                  pointerEvents: "none",
                }}
              />
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder={searchPlaceholder || "Search…"}
                autoComplete="off"
                spellCheck={false}
                aria-label={searchPlaceholder || "Search options"}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyList}
                onMouseDown={(ev) => ev.stopPropagation()}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  minHeight: 34,
                  padding: "7px 10px 7px 32px",
                  fontSize: 12.5,
                  fontWeight: 500,
                  fontFamily: SANS,
                  borderRadius: 9,
                  border: "1px solid rgba(214, 226, 240, 0.95)",
                  background: "#fff",
                  color: "#0f172a",
                  outline: "none",
                }}
              />
            </div>
          ) : null}
          <div
            id={listId}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onKeyList}
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: 4,
            }}
          >
            {filtered.length === 0 ? (
              <div
                style={{
                  padding: "14px 10px",
                  textAlign: "center",
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                No matches
              </div>
            ) : (
              filtered.map((opt, i) => {
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
                      fontSize,
                      fontWeight: sel ? 600 : 500,
                      cursor: "pointer",
                      color: "#111827",
                      ...extra,
                    }}
                  >
                    {opt.label ?? String(opt.value)}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
