"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquareText, X } from "lucide-react";
import { btn, card } from "@/lib/design/control-styles";
import { C } from "@/lib/design/tokens";
import { teamColorFor } from "@/lib/design/colors";
import { badgeStyle, btnStyle } from "@/lib/styles/controls";
import { displayClient } from "@/lib/records/form-utils";
import { chatScreenshotSrc } from "@/lib/records/screenshot-url";
import { fmtMins, replyDiffFromRecord, totalConvFromRecord } from "@/lib/utils/format-duration";
import { formatStoredTimeDisplay } from "@/lib/utils/time-input";
import type { ChatRecord } from "@/lib/db/records";

function StatusBadge({ record }: { record: Partial<ChatRecord> }) {
  const hasAnalystLast = !!(String(record.analystLastReply ?? "").trim());
  const hasFirstReply = !!(String(record.firstReply ?? "").trim());
  let text: string;
  let color: string;
  if (hasAnalystLast) {
    text = "Completed";
    color = C.green;
  } else if (!hasFirstReply) {
    text = "Awaiting reply";
    color = C.red;
  } else {
    text = "Ongoing";
    color = C.orange;
  }
  return <span style={badgeStyle(color)}>{text}</span>;
}

function DetailField({ label, value }: { label: string; value: string }) {
  const shown = (value || "").trim() || "—";
  return (
    <div className="ct-record-detail__field">
      <dt className="ct-record-detail__field-label">{label}</dt>
      <dd className="ct-record-detail__field-value" title={shown !== "—" ? shown : undefined}>
        {shown}
      </dd>
    </div>
  );
}

function ScreenshotPanel({
  label,
  path,
  onExpand,
}: {
  label: string;
  path: string;
  onExpand: () => void;
}) {
  const src = chatScreenshotSrc(path);
  if (!src) {
    return (
      <div className="ct-record-detail__shot ct-record-detail__shot--empty">
        <span className="ct-record-detail__shot-label">{label}</span>
        <span className="ct-record-detail__shot-missing">No screenshot</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="ct-record-detail__shot"
      onClick={onExpand}
      aria-label={`View ${label}`}
    >
      <span className="ct-record-detail__shot-label">{label}</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
      <img className="ct-record-detail__shot-img" src={src} alt={label} />
      <span className="ct-record-detail__shot-hint">Click to enlarge</span>
    </button>
  );
}

export default function RecordDetailModal({
  record,
  open,
  onClose,
  canUpdate = false,
  onUpdate,
}: {
  record: ChatRecord | null;
  open: boolean;
  onClose: () => void;
  canUpdate?: boolean;
  onUpdate?: (record: ChatRecord) => void;
}) {
  const [lightbox, setLightbox] = useState<{ label: string; src: string } | null>(null);

  const close = useCallback(() => {
    if (lightbox) {
      setLightbox(null);
      return;
    }
    onClose();
  }, [lightbox, onClose]);

  useEffect(() => {
    if (!open) {
      setLightbox(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || !record || typeof document === "undefined") return null;

  const subtitle = [
    record.date || null,
    record.analyst || null,
    record.team || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const firstSrc = chatScreenshotSrc(record.firstChatScreenshot);
  const lastSrc = chatScreenshotSrc(record.lastChatScreenshot);

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
        aria-labelledby="ct-record-detail-title"
        className="ct-record-detail-modal"
        style={card({
          padding: 0,
          maxWidth: 820,
          width: "100%",
          maxHeight: "min(90vh, 860px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
        })}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ct-record-detail-modal__head">
          <div className="ct-record-detail-modal__head-text">
            <span className="ct-record-detail-modal__icon" aria-hidden>
              <MessageSquareText size={18} strokeWidth={2.1} />
            </span>
            <div>
              <h2 id="ct-record-detail-title" className="ct-record-detail-modal__title">
                {displayClient(record)}
              </h2>
              <p className="ct-record-detail-modal__subtitle">{subtitle || "Chat record details"}</p>
            </div>
          </div>
          <button
            type="button"
            className="ct-catalog-modal__close"
            aria-label="Close"
            onClick={close}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="ct-record-detail-modal__body">
          <section className="ct-record-detail__module" aria-labelledby="ct-record-overview-heading">
            <div className="ct-record-detail__module-head">
              <h3 id="ct-record-overview-heading" className="ct-record-detail__module-title">
                Overview
              </h3>
              <StatusBadge record={record} />
            </div>
            <dl className="ct-record-detail__grid">
              <DetailField label="Date" value={record.date} />
              <DetailField label="Analyst" value={record.analyst} />
              <div className="ct-record-detail__field">
                <dt className="ct-record-detail__field-label">Team</dt>
                <dd className="ct-record-detail__field-value">
                  {record.team ? (
                    <span style={badgeStyle(teamColorFor(record.team), record.team)}>
                      {record.team}
                    </span>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <DetailField label="Profile" value={record.profile} />
              <DetailField label="Client name" value={record.clientName} />
              <DetailField label="Phone" value={record.phone} />
              <DetailField label="Created by" value={record.createdBy} />
              <DetailField
                label="R / A / S"
                value={`${record.received} / ${record.attempted} / ${record.resolved}`}
              />
            </dl>
          </section>

          <section className="ct-record-detail__module" aria-labelledby="ct-record-time-heading">
            <h3 id="ct-record-time-heading" className="ct-record-detail__module-title">
              Time tracking
            </h3>
            <dl className="ct-record-detail__grid ct-record-detail__grid--times">
              <DetailField
                label="1st Chat Receive"
                value={formatStoredTimeDisplay(record.firstReceive)}
              />
              <DetailField
                label="1st Reply"
                value={formatStoredTimeDisplay(record.firstReply)}
              />
              <DetailField
                label="Client Last Reply"
                value={formatStoredTimeDisplay(record.clientLastReply)}
              />
              <DetailField
                label="Analyst Last Reply"
                value={formatStoredTimeDisplay(record.analystLastReply)}
              />
              <DetailField label="Reply difference" value={fmtMins(replyDiffFromRecord(record))} />
              <DetailField
                label="Total conversation"
                value={fmtMins(totalConvFromRecord(record))}
              />
            </dl>
          </section>

          <section className="ct-record-detail__module" aria-labelledby="ct-record-shots-heading">
            <h3 id="ct-record-shots-heading" className="ct-record-detail__module-title">
              Chat screenshots
            </h3>
            <div className="ct-record-detail__shots">
              <ScreenshotPanel
                label="1st Chat Screenshot"
                path={record.firstChatScreenshot || ""}
                onExpand={() => {
                  if (firstSrc) setLightbox({ label: "1st Chat Screenshot", src: firstSrc });
                }}
              />
              <ScreenshotPanel
                label="Last Chat Screenshot"
                path={record.lastChatScreenshot || ""}
                onExpand={() => {
                  if (lastSrc) setLightbox({ label: "Last Chat Screenshot", src: lastSrc });
                }}
              />
            </div>
          </section>

          <section className="ct-record-detail__module" aria-labelledby="ct-record-notes-heading">
            <h3 id="ct-record-notes-heading" className="ct-record-detail__module-title">
              Notes
            </h3>
            <div className="ct-record-detail__notes">
              <div className="ct-record-detail__note-block">
                <div className="ct-record-detail__note-label">Analyst note</div>
                <div className="ct-record-detail__note-body">
                  {(record.note || "").trim() || "—"}
                </div>
              </div>
              <div className="ct-record-detail__note-block">
                <div className="ct-record-detail__note-label">Lead note</div>
                <div className="ct-record-detail__note-body">
                  {(record.leadNote || "").trim() || "—"}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="ct-record-detail-modal__foot">
          {canUpdate && onUpdate ? (
            <button
              type="button"
              style={btnStyle("primary", { padding: "9px 18px", minHeight: 38 })}
              onClick={() => onUpdate(record)}
            >
              Update record
            </button>
          ) : null}
          <button type="button" {...btn("ghost", { padding: "9px 18px" })} onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {lightbox ? (
        <div
          className="ct-records-shot-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.label}
          onClick={() => setLightbox(null)}
        >
          <div
            className="ct-records-shot-lightbox__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ct-records-shot-lightbox__head">
              <span className="ct-records-shot-lightbox__title">{lightbox.label}</span>
              <button
                type="button"
                className="ct-records-shot-lightbox__close"
                onClick={() => setLightbox(null)}
              >
                Close
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
            <img
              className="ct-records-shot-lightbox__img"
              src={lightbox.src}
              alt={lightbox.label}
            />
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
