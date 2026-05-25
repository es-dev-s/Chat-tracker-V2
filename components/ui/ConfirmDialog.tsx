"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { btn, card, C } from "@/lib/design/control-styles";
import { BusyLabel } from "@/components/ui/BusySpinner";

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  busyLabel = "Working…",
  error,
  onConfirm,
  onCancel,
  titleId = "ct-confirm-dialog-title",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  busyLabel?: string;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
  titleId?: string;
}) {
  const close = useCallback(() => {
    if (!busy) onCancel();
  }, [busy, onCancel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      className="ct-admin-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        className="ct-confirm-dialog"
        style={card({
          padding: "20px 22px",
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
          position: "relative",
        })}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {busy ? (
          <div className="ct-dialog-busy-overlay" aria-hidden>
            <span className="ct-dialog-busy-overlay__pill">
              <BusyLabel label={busyLabel} />
            </span>
          </div>
        ) : null}
        <div
          id={titleId}
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: C.text,
            marginBottom: 8,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </div>
        <div
          style={{
            margin: 0,
            fontSize: 13.5,
            color: C.label,
            lineHeight: 1.5,
            marginBottom: error ? 10 : 18,
          }}
        >
          {children}
        </div>
        {error ? (
          <div className="ct-field-error" style={{ marginBottom: 14 }}>
            {error}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            type="button"
            {...btn("ghost", { padding: "9px 16px" })}
            onClick={close}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            {...btn(danger ? "danger" : "primary", { padding: "9px 16px" })}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? <BusyLabel label={busyLabel} /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
