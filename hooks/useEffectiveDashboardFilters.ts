"use client";

import { useDeferredValue, useMemo } from "react";
import type { DashboardFilters } from "@/lib/dashboard/records";
import { useGlobalFiltersStore } from "@/store/global-filters-store";

/** Applies deferred search so typing stays instant while filtering stays smooth. */
export function useEffectiveDashboardFilters(): DashboardFilters {
  const filters = useGlobalFiltersStore((s) => s.filters);
  const deferredSearch = useDeferredValue(filters.searchQuery);

  return useMemo(
    () => ({ ...filters, searchQuery: deferredSearch }),
    [filters, deferredSearch],
  );
}

export function useIsSearchFilterPending(): boolean {
  const searchQuery = useGlobalFiltersStore((s) => s.filters.searchQuery);
  const deferredSearch = useDeferredValue(searchQuery);
  return searchQuery !== deferredSearch;
}
