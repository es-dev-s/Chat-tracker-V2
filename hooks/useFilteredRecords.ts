"use client";

import { useMemo } from "react";
import { filterRecordsByDashboardFilters } from "@/lib/dashboard/records";
import type { ChatRecord } from "@/lib/db/records";
import { useEffectiveDashboardFilters } from "@/hooks/useEffectiveDashboardFilters";

export function useFilteredRecords(records: ChatRecord[]): ChatRecord[] {
  const filters = useEffectiveDashboardFilters();

  return useMemo(
    () => filterRecordsByDashboardFilters(records, filters),
    [records, filters],
  );
}
