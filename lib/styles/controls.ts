import type { CSSProperties } from "react";
import { C, RAD, SANS } from "@/lib/design/tokens";
import { teamColorFor } from "@/lib/design/colors";

export function inputStyle(extra: CSSProperties = {}): CSSProperties {
  return {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: RAD.md,
    padding: "10px 14px",
    color: C.text,
    fontFamily: SANS,
    fontSize: 13,
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
    lineHeight: 1.35,
    transition:
      "border-color 0.18s ease, box-shadow 0.2s cubic-bezier(0.2, 0.82, 0.22, 1)",
    ...extra,
  };
}

export type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

export function btnStyle(
  variant: BtnVariant = "primary",
  extra: CSSProperties = {},
): CSSProperties {
  const base: CSSProperties = {
    padding: "10px 18px",
    borderRadius: RAD.md,
    cursor: "pointer",
    fontFamily: SANS,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.2,
    border: "none",
    boxSizing: "border-box",
    minHeight: 40,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition:
      "transform 0.16s cubic-bezier(0.2, 0.82, 0.22, 1), opacity 0.18s ease, background-color 0.18s ease, border-color 0.18s ease",
    ...extra,
  };

  if (variant === "primary") {
    return { ...base, background: C.accent, color: "#fff" };
  }
  if (variant === "secondary") {
    return {
      ...base,
      background: "#f8fafc",
      color: C.text,
      border: `1px solid ${C.border}`,
    };
  }
  if (variant === "ghost") {
    return {
      ...base,
      background: "rgba(255,255,255,0.72)",
      color: C.muted,
      border: `1px solid ${C.border}`,
    };
  }
  return {
    ...base,
    background: "#fef2f2",
    color: C.red,
    border: `1px solid ${C.red}33`,
  };
}

export function cardStyle(extra: CSSProperties = {}): CSSProperties {
  return {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: RAD.lg,
    boxShadow:
      "0 4px 16px rgba(29, 78, 216, 0.06), 0 1px 0 rgba(255,255,255,0.7) inset",
    ...extra,
  };
}

export function fieldLabelStyle(extra: CSSProperties = {}): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: C.muted,
    marginBottom: 7,
    ...extra,
  };
}

export function badgeStyle(color?: string, text?: string): CSSProperties {
  const resolvedColor = color || teamColorFor(text || "");
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.01em",
    background: `${resolvedColor}14`,
    color: resolvedColor,
    border: `1px solid ${resolvedColor}2a`,
    maxWidth: "100%",
    whiteSpace: "nowrap",
  };
}
