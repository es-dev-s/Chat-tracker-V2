"use client";

import type { LucideIcon } from "lucide-react";
import KpiStatCard, {
  type KpiStatTone,
  type KpiStatVariant,
} from "@/components/dashboard/KpiStatCard";

export type DashboardKpiItem = {
  label: string;
  value: string | number;
  sub?: string;
  tone: KpiStatTone;
  variant?: KpiStatVariant;
  valueType?: "metric" | "text";
  icon: LucideIcon;
};

export default function DashboardKpiBoard({ items }: { items: DashboardKpiItem[] }) {
  return (
    <div className="ct-kpi-board">
      {items.map((item) => (
        <KpiStatCard key={item.label} {...item} />
      ))}
    </div>
  );
}
