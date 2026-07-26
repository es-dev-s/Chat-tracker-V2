"use client";

import { useRef, useState } from "react";
import { btnStyle } from "@/lib/styles/controls";
import { chatScreenshotSrc } from "@/lib/records/screenshot-url";

type Kind = "first" | "last";

type Props = {
  label: string;
  kind: Kind;
  value: string;
  onChange: (path: string) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
};

async function uploadScreenshot(kind: Kind, file: File): Promise<string> {
  const body = new FormData();
  body.set("kind", kind);
  body.set("file", file);
  const res = await fetch("/api/uploads/chat-screenshot", {
    method: "POST",
    credentials: "include",
    body,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = String(data.error);
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const data = await res.json();
  const path = String(data?.path ?? "").trim();
  if (!path) throw new Error("Upload failed.");
  return path;
}

export default function ChatScreenshotField({
  label,
  kind,
  value,
  onChange,
  required = false,
  disabled = false,
  id,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const src = chatScreenshotSrc(value);
  const inputId = id || `ct-shot-${kind}`;

  const onPick = async (file: File | null) => {
    if (!file || disabled || busy) return;
    setBusy(true);
    setError("");
    try {
      const path = await uploadScreenshot(kind, file);
      onChange(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="ct-log-shot-field">
      <div className="ct-log-shot-field__label-row">
        <label
          className={`ct-log-shot-field__label${required ? " ct-log-shot-field__label--required" : ""}`}
          htmlFor={inputId}
        >
          {label}
        </label>
        {src ? (
          <button
            type="button"
            className="ct-log-shot-field__clear"
            disabled={disabled || busy}
            onClick={() => {
              setError("");
              onChange("");
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div
        className={[
          "ct-log-shot-drop",
          src ? "ct-log-shot-drop--filled" : "",
          dragOver ? "ct-log-shot-drop--drag" : "",
          busy ? "ct-log-shot-drop--busy" : "",
          disabled ? "ct-log-shot-drop--disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled && !busy) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !busy) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void onPick(e.dataTransfer.files?.[0] ?? null);
        }}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="ct-log-shot-drop__input"
          disabled={disabled || busy}
          onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
          aria-label={label}
        />

        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated API image
          <img className="ct-log-shot-drop__preview" src={src} alt={label} />
        ) : (
          <div className="ct-log-shot-drop__placeholder">
            <span className="ct-log-shot-drop__placeholder-title">
              {busy ? "Uploading…" : "Drop image or click to upload"}
            </span>
            <span className="ct-log-shot-drop__placeholder-meta">
              PNG, JPG, WebP, or GIF · max 5 MB
            </span>
          </div>
        )}
      </div>

      {src ? (
        <div className="ct-log-shot-field__actions">
          <button
            type="button"
            style={btnStyle("secondary", {
              padding: "8px 12px",
              minHeight: 34,
              fontSize: 12,
            })}
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Uploading…" : "Replace"}
          </button>
        </div>
      ) : null}

      {error ? <div className="ct-log-shot-field__error">{error}</div> : null}
    </div>
  );
}
