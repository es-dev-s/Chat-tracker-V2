import { create } from "zustand";
import {
  EMPTY_DASHBOARD_FILTERS,
  type DashboardFilters,
} from "@/lib/dashboard/records";

type GlobalFiltersState = {
  filters: DashboardFilters;
  setFilter: (key: keyof DashboardFilters, value: string) => void;
  clearFilters: () => void;
};

export const useGlobalFiltersStore = create<GlobalFiltersState>((set) => ({
  filters: { ...EMPTY_DASHBOARD_FILTERS },
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  clearFilters: () => set({ filters: { ...EMPTY_DASHBOARD_FILTERS } }),
}));
