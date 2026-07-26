"use client";

import { useEffect, useState } from "react";
import { chatScreenshotSrc } from "@/lib/records/screenshot-url";

type Props = {
  path: string | null | undefined;
  label: string;
};

export default function ChatScreenshotThumb({ path, label }: Props) {
  const src = chatScreenshotSrc(path);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!src) {
    return <span className="ct-records-shot ct-records-shot--empty">—</span>;
  }

  return (
    <>
      <button
        type="button"
        className="ct-records-shot"
        onClick={() => setOpen(true)}
        title={`View ${label}`}
        aria-label={`View ${label}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
        <img className="ct-records-shot__thumb" src={src} alt="" />
      </button>
      {open ? (
        <div
          className="ct-records-shot-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={() => setOpen(false)}
        >
          <div
            className="ct-records-shot-lightbox__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ct-records-shot-lightbox__head">
              <span className="ct-records-shot-lightbox__title">{label}</span>
              <button
                type="button"
                className="ct-records-shot-lightbox__close"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
            <img className="ct-records-shot-lightbox__img" src={src} alt={label} />
          </div>
        </div>
      ) : null}
    </>
  );
}
