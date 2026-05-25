"use client";

import type { LucideIcon } from "lucide-react";

export type KpiStatTone =
  | "blue"
  | "cyan"
  | "green"
  | "amber"
  | "violet"
  | "rose"
  | "slate";

export type KpiStatVariant = "default" | "alert";

export default function KpiStatCard({
  label,
  value,
  sub,
  tone = "blue",
  variant = "default",
  valueType = "metric",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: KpiStatTone;
  variant?: KpiStatVariant;
  valueType?: "metric" | "text";
  icon: LucideIcon;
}) {
  return (
    <article
      className={`ct-kpi-stat ct-kpi-stat--${tone} ct-kpi-stat--${variant}${
        valueType === "text" ? " ct-kpi-stat--text-value" : ""
      }`}
    >
      <div className="ct-kpi-stat__top">
        <span className="ct-kpi-stat__icon-wrap" aria-hidden>
          <Icon size={15} strokeWidth={2.05} className="ct-kpi-stat__icon" />
        </span>
        <span className="ct-kpi-stat__label">{label}</span>
      </div>

      <div className="ct-kpi-stat__value">{value}</div>

      {sub ? <p className="ct-kpi-stat__sub">{sub}</p> : null}
    </article>
  );
}
