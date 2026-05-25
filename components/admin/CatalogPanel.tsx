"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, Tag, Trash2, Users, X } from "lucide-react";
import { BusyLabel } from "@/components/ui/BusySpinner";
import { C, RAD } from "@/lib/design/tokens";
import { btn, card, input } from "@/lib/design/control-styles";

export type CatalogTone = "profile" | "team";

export function catalogToneMeta(tone: CatalogTone) {
  if (tone === "profile") {
    return {
      accentSoft: "#f1ecff",
      accentBorder: "#ddd6fe",
      countColor: "#6d28d9",
      Icon: Tag,
      manageLabel: "Manage Profiles",
      addLabel: "Add Profile",
      emptyLabel: "No profiles added yet.",
      noMatchLabel: "No profiles match your search.",
      searchPlaceholder: "Search profiles…",
      inputPlaceholder: "New profile name",
      modalTitle: "Manage profile names",
      modalSubtitle: "Add, search, and remove catalog profiles used when assigning users.",
    };
  }
  return {
    accentSoft: "#eaf3ff",
    accentBorder: "#bfdbfe",
    countColor: "#1d4ed8",
    Icon: Users,
    manageLabel: "Manage Teams",
    addLabel: "Add Team",
    emptyLabel: "No teams added yet.",
    noMatchLabel: "No teams match your search.",
    searchPlaceholder: "Search teams…",
    inputPlaceholder: "New team name",
    modalTitle: "Manage team names",
    modalSubtitle: "Add, search, and remove teams. Deleting a team removes related members and records.",
  };
}

function CatalogItemRow({
  label,
  tone,
  accentHex,
  onRemove,
}: {
  label: string;
  tone: CatalogTone;
  accentHex?: string;
  onRemove: () => void;
}) {
  const isTeam = tone === "team";
  const accent = isTeam ? accentHex || "#2563eb" : "#7c3aed";

  return (
    <div className="ct-catalog-item">
      <div className="ct-catalog-item__main" title={label}>
        <span
          className="ct-catalog-item__dot"
          style={{
            background: isTeam ? accent : "#ede9fe",
            color: isTeam ? "#fff" : "#7c3aed",
          }}
          aria-hidden
        >
          {isTeam ? "T" : "P"}
        </span>
        <span className="ct-catalog-item__label">{label}</span>
      </div>
      <button
        type="button"
        className="ct-catalog-item__remove"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        title={`Remove ${label}`}
      >
        <Trash2 size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

export default function CatalogPanel({
  tone,
  open,
  onOpenChange,
  items,
  filteredItems,
  search,
  onSearchChange,
  newName,
  onNewNameChange,
  onAdd,
  onRemove,
  savedFlash,
  savedMessage,
  teamColorFor,
}: {
  tone: CatalogTone;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: string[];
  filteredItems: string[];
  search: string;
  onSearchChange: (v: string) => void;
  newName: string;
  onNewNameChange: (v: string) => void;
  onAdd: () => boolean | Promise<boolean>;
  onRemove: (name: string) => boolean | Promise<boolean>;
  savedFlash?: boolean;
  savedMessage?: string;
  teamColorFor?: (name: string) => string;
}) {
  const meta = catalogToneMeta(tone);
  const TitleIcon = meta.Icon;
  const canAdd = Boolean(newName.trim());
  const [saving, setSaving] = useState(false);

  const closeModal = useCallback(() => {
    if (saving) return;
    onOpenChange(false);
    onSearchChange("");
  }, [onOpenChange, onSearchChange, saving]);

  const handleAdd = async () => {
    if (!canAdd || saving) return;
    setSaving(true);
    try {
      const ok = await Promise.resolve(onAdd());
      if (ok) closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (name: string) => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await Promise.resolve(onRemove(name));
      if (ok) closeModal();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      className="ct-admin-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`ct-catalog-modal-title-${tone}`}
        aria-busy={saving || undefined}
        className="ct-catalog-modal"
        style={{
          ...card({
            padding: 0,
            maxWidth: 520,
            width: "100%",
            maxHeight: "min(88vh, 640px)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
          }),
          position: "relative",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {saving ? (
          <div className="ct-dialog-busy-overlay" aria-hidden>
            <span className="ct-dialog-busy-overlay__pill">
              <BusyLabel label="Saving…" />
            </span>
          </div>
        ) : null}
        <div className="ct-catalog-modal__head">
          <div className="ct-catalog-modal__head-text">
            <span
              className="ct-catalog-panel__icon"
              style={{
                background: meta.accentSoft,
                borderColor: meta.accentBorder,
                color: meta.countColor,
              }}
            >
              <TitleIcon size={18} strokeWidth={2.25} aria-hidden />
            </span>
            <div>
              <h2 id={`ct-catalog-modal-title-${tone}`} className="ct-catalog-modal__title">
                {meta.modalTitle}
              </h2>
              <p className="ct-catalog-modal__subtitle">{meta.modalSubtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="ct-catalog-modal__close"
            aria-label="Close"
            onClick={closeModal}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="ct-catalog-modal__body">
          <div className="ct-catalog-add-row">
            <input
              className="ct-input ct-catalog-add-row__input"
              style={input()}
              placeholder={meta.inputPlaceholder}
              value={newName}
              disabled={saving}
              onChange={(e) => onNewNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              aria-label={meta.inputPlaceholder}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <button
              type="button"
              className="ct-catalog-add-row__btn"
              disabled={!canAdd || saving}
              aria-busy={saving || undefined}
              {...btn("primary", {
                padding: "0 16px",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              })}
              onClick={() => void handleAdd()}
            >
              {saving ? (
                <BusyLabel label="Adding…" size={16} />
              ) : (
                <>
                  <Plus size={16} strokeWidth={2.5} aria-hidden />
                  {meta.addLabel}
                </>
              )}
            </button>
          </div>

          {savedFlash && savedMessage ? (
            <div className="ct-catalog-panel__flash" role="status">
              {savedMessage}
            </div>
          ) : null}

          <div className="ct-catalog-search-wrap">
            <Search
              size={16}
              strokeWidth={1.75}
              aria-hidden
              className="ct-catalog-search-wrap__icon"
            />
            <input
              className="ct-input ct-catalog-search-wrap__input"
              style={input()}
              type="search"
              placeholder={meta.searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label={meta.searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {search.trim() ? (
            <div className="ct-catalog-panel__filter-hint">
              Showing <strong>{filteredItems.length}</strong> of {items.length}
            </div>
          ) : null}

          <div
            className="ct-catalog-scroll ct-catalog-scroll--modal"
            style={{
              borderRadius: RAD.md,
              borderColor: C.border,
              background: C.card2,
            }}
          >
            {items.length === 0 ? (
              <p className="ct-catalog-empty">{meta.emptyLabel}</p>
            ) : filteredItems.length === 0 ? (
              <p className="ct-catalog-empty">{meta.noMatchLabel}</p>
            ) : (
              <div className="ct-catalog-grid">
                {filteredItems.map((name) => (
                  <CatalogItemRow
                    key={name}
                    label={name}
                    tone={tone}
                    accentHex={tone === "team" && teamColorFor ? teamColorFor(name) : undefined}
                    onRemove={() => void handleRemove(name)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ct-catalog-modal__foot">
          <button type="button" {...btn("ghost", { padding: "9px 18px" })} onClick={closeModal} disabled={saving}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
