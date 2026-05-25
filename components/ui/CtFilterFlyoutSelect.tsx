"use client";

import { useMemo } from "react";
import { ChevronLeft } from "lucide-react";
import type { CtSelectOption } from "@/components/ui/CtSelect";
import { useFilterPickerStore } from "@/store/filter-picker-store";

type CtFilterFlyoutSelectProps = {
  fieldId: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | CtSelectOption)[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
};

/** Filter field trigger — opens the left flyout picker in the filter rail. */
export default function CtFilterFlyoutSelect({
  fieldId,
  title,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  id,
  "aria-label": ariaLabel,
}: CtFilterFlyoutSelectProps) {
  const openPicker = useFilterPickerStore((s) => s.openPicker);
  const activeFieldId = useFilterPickerStore((s) => s.fieldId);
  const pickerOpen = useFilterPickerStore((s) => s.open);

  const normValue = value == null ? "" : String(value);
  const isActive = pickerOpen && activeFieldId === fieldId;

  const flat = useMemo(
    () =>
      options.map((o) => (typeof o === "string" ? { value: o, label: o } : { ...o })),
    [options],
  );

  const selected = flat.find((o) => String(o.value) === normValue);
  const display = selected ? (selected.label ?? String(selected.value)) : "";

  const openFlyout = () => {
    if (disabled) return;
    openPicker({
      fieldId,
      title,
      options: flat,
      value: normValue,
      onChange,
    });
  };

  return (
    <button
      type="button"
      id={id}
      disabled={disabled}
      aria-label={ariaLabel ?? title}
      aria-expanded={isActive}
      aria-haspopup="listbox"
      className={`ct-filter-control ct-filter-flyout-trigger${isActive ? " ct-filter-flyout-trigger--open" : ""}${display ? " ct-filter-flyout-trigger--filled" : ""}`}
      onClick={openFlyout}
    >
      <span className="ct-filter-flyout-trigger__value">
        {display || <span className="ct-filter-flyout-trigger__placeholder">{placeholder}</span>}
      </span>
      <ChevronLeft
        size={15}
        strokeWidth={2.15}
        aria-hidden
        className="ct-filter-flyout-trigger__chevron"
      />
    </button>
  );
}
