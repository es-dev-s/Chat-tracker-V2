"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Search, X } from "lucide-react";
import { useFilterPickerStore } from "@/store/filter-picker-store";

const SEARCH_THRESHOLD = 8;

export default function FilterPickerFlyout() {
  const open = useFilterPickerStore((s) => s.open);
  const title = useFilterPickerStore((s) => s.title);
  const options = useFilterPickerStore((s) => s.options);
  const value = useFilterPickerStore((s) => s.value);
  const closePicker = useFilterPickerStore((s) => s.closePicker);
  const pick = useFilterPickerStore((s) => s.pick);

  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const t = window.setTimeout(() => searchRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open, title]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePicker();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closePicker]);

  const showSearch = options.length >= SEARCH_THRESHOLD;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const label = (o.label ?? String(o.value)).toLowerCase();
      return label.includes(q) || String(o.value).toLowerCase().includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const t = window.setTimeout(() => {
      listRef.current
        ?.querySelector(".ct-filter-flyout__option--selected")
        ?.scrollIntoView({ block: "nearest" });
    }, 140);
    return () => window.clearTimeout(t);
  }, [open, value, filtered.length]);

  return (
    <div
      className={`ct-filter-flyout${open ? " ct-filter-flyout--open" : ""}`}
      aria-hidden={!open}
    >
      <div className="ct-filter-flyout__inner">
        {open ? (
          <>
            <header className="ct-filter-flyout__head">
              <button
                type="button"
                className="ct-filter-flyout__back"
                onClick={() => closePicker()}
                aria-label="Close picker"
              >
                <ChevronLeft size={16} strokeWidth={2.25} aria-hidden />
              </button>
              <div className="ct-filter-flyout__head-copy">
                <span className="ct-filter-flyout__eyebrow">Choose</span>
                <h2 className="ct-filter-flyout__title">{title}</h2>
              </div>
              <button
                type="button"
                className="ct-filter-flyout__close"
                onClick={() => closePicker()}
                aria-label="Close picker"
              >
                <X size={15} strokeWidth={2.25} aria-hidden />
              </button>
            </header>

            {showSearch ? (
              <div className="ct-filter-flyout__search-wrap">
                <Search size={14} strokeWidth={2.15} aria-hidden className="ct-filter-flyout__search-icon" />
                <input
                  ref={searchRef}
                  type="search"
                  className="ct-filter-flyout__search"
                  placeholder={`Search ${title.toLowerCase()}…`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ) : null}

            <div
              ref={listRef}
              className="ct-filter-flyout__list"
              role="listbox"
              aria-label={title}
            >
              {filtered.length === 0 ? (
                <p className="ct-filter-flyout__empty">No matches</p>
              ) : (
                filtered.map((opt, i) => {
                  const sel = String(opt.value) === String(value);
                  return (
                    <button
                      key={`${String(opt.value)}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={sel}
                      className={`ct-filter-flyout__option${sel ? " ct-filter-flyout__option--selected" : ""}`}
                      onClick={() => pick(String(opt.value))}
                    >
                      <span className="ct-filter-flyout__option-label">
                        {opt.label ?? String(opt.value)}
                      </span>
                      {sel ? (
                        <Check size={15} strokeWidth={2.5} aria-hidden className="ct-filter-flyout__option-check" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
