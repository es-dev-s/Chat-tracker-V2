"use client";

import { useEffect, useState } from "react";
import { PanelRightClose, SlidersHorizontal } from "lucide-react";
import GlobalFiltersPanel, { useGlobalFiltersActiveCount } from "./GlobalFiltersPanel";
import FilterPickerFlyout from "./FilterPickerFlyout";
import { useFilterPickerStore } from "@/store/filter-picker-store";

const STORAGE_KEY = "ct-filter-rail-open";

function readStoredOpen(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

export default function FilterSidebar() {
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);
  const activeCount = useGlobalFiltersActiveCount();
  const pickerOpen = useFilterPickerStore((s) => s.open);
  const closePicker = useFilterPickerStore((s) => s.closePicker);

  useEffect(() => {
    setOpen(readStoredOpen());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!open) closePicker();
  }, [open, closePicker]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const rail = document.querySelector(".ct-filter-rail");
      if (rail && !rail.contains(e.target as Node)) closePicker();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [pickerOpen, closePicker]);

  const toggle = () => {
    setOpen((value) => {
      const next = !value;
      try {
        sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        //
      }
      return next;
    });
  };

  return (
    <aside
      className={`ct-filter-rail${open ? " ct-filter-rail--open" : ""}${ready ? " ct-filter-rail--ready" : ""}${activeCount > 0 ? " ct-filter-rail--has-filters" : ""}${pickerOpen ? " ct-filter-rail--picker-open" : ""}`}
      aria-label="Workspace filters"
    >
      <FilterPickerFlyout />

      <div
        id="ct-filter-rail-panel"
        className="ct-filter-rail__panel"
        aria-hidden={!open}
      >
        <div className="ct-filter-rail__panel-inner">
          <GlobalFiltersPanel />
        </div>
      </div>

      <button
        type="button"
        className="ct-filter-rail__toggle"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="ct-filter-rail-panel"
        title={open ? "Hide filters" : "Show filters"}
      >
        <span className="ct-filter-rail__toggle-glyph">
          <span className="ct-filter-rail__toggle-icon" aria-hidden>
            <PanelRightClose
              size={17}
              strokeWidth={2.15}
              className={`ct-filter-rail__icon-close${open ? " is-visible" : ""}`}
            />
            <SlidersHorizontal
              size={17}
              strokeWidth={2.15}
              className={`ct-filter-rail__icon-open${open ? "" : " is-visible"}`}
            />
          </span>
          {!open && activeCount > 0 ? (
            <span className="ct-filter-rail__toggle-badge" aria-hidden>
              {activeCount}
            </span>
          ) : null}
        </span>
        <span className="ct-filter-rail__toggle-label">
          {open ? "Hide" : "Filters"}
        </span>
      </button>
    </aside>
  );
}
