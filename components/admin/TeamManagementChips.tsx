"use client";

import { C } from "@/lib/design/tokens";

type ChipProps = {
  label: string;
  dotColor?: string;
  pillTintHex?: string;
  onDismiss: () => void;
  dismissLabel?: string;
};

export function DismissiblePillChip({
  label,
  dotColor,
  pillTintHex,
  onDismiss,
  dismissLabel,
}: ChipProps) {
  const aria = dismissLabel || `Remove ${label}`;
  const tint = (pillTintHex || "").trim();
  const useTint = Boolean(tint);
  const baseBorder = useTint ? `${tint}55` : C.border;
  const baseBg = useTint
    ? `linear-gradient(165deg, ${tint}34 0%, ${tint}16 46%, rgba(255,255,255,.97) 100%)`
    : C.card;
  const baseShadow = useTint
    ? `0 1px 3px ${tint}24, inset 0 1px 0 rgba(255,255,255,.85)`
    : "0 1px 2px rgba(15, 23, 42, 0.045)";

  return (
    <button
      type="button"
      title={aria}
      aria-label={aria}
      onClick={onDismiss}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        maxWidth: "100%",
        borderRadius: 999,
        background: baseBg,
        border: `1px solid ${baseBorder}`,
        boxShadow: baseShadow,
        padding: "5px 10px",
        fontSize: 13,
        fontWeight: 500,
        color: C.text,
        verticalAlign: "middle",
        cursor: "pointer",
        fontFamily: "inherit",
        transition:
          "box-shadow .14s ease, border-color .14s ease, background .14s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = useTint
          ? `0 3px 12px ${tint}35`
          : "0 3px 10px rgba(15, 23, 42, 0.08)";
        e.currentTarget.style.borderColor = `${C.red}55`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = baseShadow;
        e.currentTarget.style.borderColor = baseBorder;
      }}
    >
      {dotColor ? (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: dotColor,
            flexShrink: 0,
            boxShadow: "inset 0 0 0 1px rgba(15,23,42,.08)",
          }}
        />
      ) : null}
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          color: C.muted,
          fontSize: 15,
          lineHeight: 1,
          fontWeight: 500,
          marginLeft: 2,
        }}
      >
        ×
      </span>
    </button>
  );
}

type OutlineChipProps = {
  label: string;
  dotColor?: string;
  onAdd: () => void;
};

export function OutlineTeamPickerChip({ label, dotColor, onAdd }: OutlineChipProps) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Add ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        maxWidth: "100%",
        borderRadius: 999,
        background: "rgba(255,255,255,.75)",
        border: `2px dashed ${C.border}`,
        padding: "6px 12px 6px 10px",
        fontSize: 13,
        fontWeight: 500,
        color: C.label,
        cursor: "pointer",
        verticalAlign: "middle",
        fontFamily: "inherit",
        transition:
          "border-color .12s ease, background .12s ease, color .12s ease, box-shadow .12s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${C.accent}99`;
        e.currentTarget.style.background = `${C.accent}0d`;
        e.currentTarget.style.color = C.text;
        e.currentTarget.style.boxShadow = `0 0 0 1px ${C.accent}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.background = "rgba(255,255,255,.75)";
        e.currentTarget.style.color = C.label;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 22,
          height: 22,
          borderRadius: 999,
          border: `1.5px dashed ${C.border}`,
          color: C.muted,
          fontSize: 16,
          lineHeight: "20px",
          fontWeight: 500,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        +
      </span>
      {dotColor ? (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: `${dotColor}aa`,
            flexShrink: 0,
            opacity: 0.85,
          }}
        />
      ) : null}
      <span
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        aria-hidden
        style={{
          marginLeft: 2,
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: C.muted,
        }}
      >
        add
      </span>
    </button>
  );
}
