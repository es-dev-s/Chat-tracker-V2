"use client";

import { AlertCircle } from "lucide-react";
import type { RecordTimeFieldError } from "@/lib/records/form-utils";

export default function LogTimeFieldHint({
  error,
  id,
}: {
  error: RecordTimeFieldError;
  id?: string;
}) {
  return (
    <div id={id} className="ct-log-time-hint" role="alert">
      <AlertCircle size={14} strokeWidth={2.2} className="ct-log-time-hint__icon" aria-hidden />
      <div className="ct-log-time-hint__body">
        <p className="ct-log-time-hint__title">{error.title}</p>
        <p className="ct-log-time-hint__detail">{error.detail}</p>
        <p className="ct-log-time-hint__times">
          <span className="ct-log-time-hint__times-entered">{error.enteredTime}</span>
          <span className="ct-log-time-hint__times-sep" aria-hidden>
            →
          </span>
          <span className="ct-log-time-hint__times-anchor">
            {error.anchorTime}
            <span className="ct-log-time-hint__chip-ref"> ({error.anchorLabel})</span>
          </span>
        </p>
      </div>
    </div>
  );
}
