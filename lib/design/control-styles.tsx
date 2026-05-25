import type { CSSProperties, ReactNode } from "react";
import { teamColorFor } from "@/lib/design/colors";
import { C, MONO, RAD, SANS, TYPE } from "@/lib/design/tokens";

export function card(extra: CSSProperties = {}): CSSProperties {
  return {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: RAD.lg,
    boxShadow:
      "0 4px 16px rgba(29, 78, 216, 0.06), 0 1px 0 rgba(255,255,255,0.7) inset",
    transition:
      "box-shadow 0.24s cubic-bezier(0.2, 0.82, 0.22, 1), border-color 0.2s cubic-bezier(0.2, 0.82, 0.22, 1)",
    ...extra,
  };
}

export function input(extra: CSSProperties = {}): CSSProperties {
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

type BtnVariant = "primary" | "secondary" | "ghost" | "bare" | "danger";

export function btn(
  variant: BtnVariant = "primary",
  extra: CSSProperties = {},
): { style: CSSProperties; "data-variant": string } {
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
      "transform 0.16s cubic-bezier(0.2, 0.82, 0.22, 1), box-shadow 0.22s cubic-bezier(0.2, 0.82, 0.22, 1), filter 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, opacity 0.18s ease",
    ...extra,
  };

  if (variant === "primary") {
    return { style: { ...base, background: C.accent, color: "#fff" }, "data-variant": "primary" };
  }
  if (variant === "secondary") {
    return {
      style: {
        ...base,
        background: "#f8fafc",
        color: C.text,
        border: `1px solid ${C.border}`,
      },
      "data-variant": "secondary",
    };
  }
  if (variant === "ghost") {
    return {
      style: {
        ...base,
        background: "rgba(255,255,255,0.72)",
        color: C.muted,
        border: `1px solid ${C.border}`,
      },
      "data-variant": "ghost",
    };
  }
  if (variant === "bare") {
    return {
      style: {
        ...base,
        background: "transparent",
        color: C.text,
        border: "1px solid transparent",
        minHeight: 36,
      },
      "data-variant": "bare",
    };
  }
  return {
    style: {
      ...base,
      background: "#fef2f2",
      color: C.red,
      border: "1px solid rgba(220, 38, 38, 0.22)",
    },
    "data-variant": "dangerGhost",
  };
}

export function sectionTitle(text: string): ReactNode {
  return (
    <div style={{ ...TYPE.sectionUpper, color: C.muted, marginBottom: 14 }}>{text}</div>
  );
}

export function badge(text: string, color?: string): ReactNode {
  const resolvedColor = color || teamColorFor(text);
  return (
    <span
      role="presentation"
      style={{
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
      }}
    >
      {text}
    </span>
  );
}

export function TH({
  children,
  align,
  title,
}: {
  children: ReactNode;
  align?: CSSProperties["textAlign"];
  title?: string;
}) {
  return (
    <th
      title={title}
      style={{
        textAlign: align || "left",
        padding: "11px 14px",
        borderBottom: `1px solid ${C.border}`,
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.09em",
        color: C.muted,
        background: "#f3f8ff",
        whiteSpace: "nowrap",
        fontFamily: SANS,
        verticalAlign: "middle",
        boxShadow: `inset 0 -1px 0 ${C.dim}`,
      }}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  mono,
  color,
  align,
  ellipsis,
  title,
}: {
  children: ReactNode;
  mono?: boolean;
  color?: string;
  align?: CSSProperties["textAlign"];
  ellipsis?: boolean;
  title?: string;
}) {
  return (
    <td
      style={{
        padding: "12px 14px",
        borderBottom: `1px solid ${C.dim}`,
        color: color || C.text,
        fontFamily: mono ? MONO : SANS,
        fontSize: mono ? 12.5 : 13,
        fontVariantNumeric: mono ? "tabular-nums" : undefined,
        textAlign: align,
        verticalAlign: "middle",
        maxWidth: ellipsis ? 240 : undefined,
        overflow: ellipsis ? "hidden" : undefined,
        whiteSpace: ellipsis ? "nowrap" : undefined,
        textOverflow: ellipsis ? "ellipsis" : undefined,
      }}
      title={title != null && title !== "" ? title : undefined}
    >
      {children}
    </td>
  );
}

export { C, MONO, RAD, SANS, TYPE };
