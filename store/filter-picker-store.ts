"use client";

import { create } from "zustand";
import type { CtSelectOption } from "@/components/ui/CtSelect";

export type FilterPickerConfig = {
  fieldId: string;
  title: string;
  options: CtSelectOption[];
  value: string;
  onChange: (value: string) => void;
};

type FilterPickerState = {
  open: boolean;
  fieldId: string | null;
  title: string;
  options: CtSelectOption[];
  value: string;
  onChange: ((value: string) => void) | null;
  openPicker: (config: FilterPickerConfig) => void;
  closePicker: () => void;
  pick: (value: string) => void;
};

export const useFilterPickerStore = create<FilterPickerState>((set, get) => ({
  open: false,
  fieldId: null,
  title: "",
  options: [],
  value: "",
  onChange: null,

  openPicker: ({ fieldId, title, options, value, onChange }) => {
    const current = get();
    if (current.open && current.fieldId === fieldId) {
      set({
        open: false,
        fieldId: null,
        onChange: null,
      });
      return;
    }
    set({
      open: true,
      fieldId,
      title,
      options,
      value,
      onChange,
    });
  },

  closePicker: () => {
    set({
      open: false,
      fieldId: null,
      onChange: null,
    });
  },

  pick: (value: string) => {
    const { onChange } = get();
    onChange?.(value);
    set({
      open: false,
      fieldId: null,
      onChange: null,
    });
  },
}));
