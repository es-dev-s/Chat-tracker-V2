"use client";

import CtDateInput from "@/components/ui/CtDateInput";
import LogTimePicker from "@/components/log/LogTimePicker";
import LogTimeFieldHint from "@/components/log/LogTimeFieldHint";
import type { RecordTimeFieldError } from "@/lib/records/form-utils";
import type { TimeEventDateKey, TimeEventKey } from "@/lib/utils/event-datetime";
import { resolveEventDate } from "@/lib/utils/event-datetime";

export type LogTimeFieldConfig = {
  label: string;
  timeKey: TimeEventKey;
  dateKey: TimeEventDateKey;
  required: boolean;
};

export const LOG_TIME_FIELD_CONFIGS: readonly LogTimeFieldConfig[] = [
  { label: "1st Chat Receive", timeKey: "firstReceive", dateKey: "firstReceiveDate", required: true },
  { label: "1st Reply", timeKey: "firstReply", dateKey: "firstReplyDate", required: false },
  { label: "Client Last Reply", timeKey: "clientLastReply", dateKey: "clientLastReplyDate", required: false },
  { label: "Analyst Last Reply", timeKey: "analystLastReply", dateKey: "analystLastReplyDate", required: false },
] as const;

export default function LogTimeFieldRow({
  config,
  idPrefix,
  recordDate,
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  fieldError,
  formEpoch,
}: {
  config: LogTimeFieldConfig;
  idPrefix: string;
  recordDate: string;
  dateValue: string;
  timeValue: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  fieldError?: RecordTimeFieldError;
  formEpoch: number;
}) {
  const { label, timeKey, required } = config;
  const resolvedDate = resolveEventDate(dateValue, recordDate);
  const timeId = `${idPrefix}-time-${timeKey}`;
  const dateId = `${idPrefix}-date-${timeKey}`;

  return (
    <div
      className={`ct-log-time-field${fieldError ? " ct-log-time-field--invalid" : ""}`}
    >
      <label
        className={`ct-log-time-field__label${required ? " ct-log-time-field__label--required" : ""}`}
        htmlFor={timeId}
      >
        {label}
      </label>
      <div className="ct-log-time-field__controls">
        <div className="ct-log-time-field__date">
          <CtDateInput
            key={`${dateId}-${formEpoch}-${resolvedDate}`}
            id={dateId}
            iconTriggerOnly
            compact
            value={resolvedDate}
            onChange={onDateChange}
            aria-label={`${label} date`}
          />
        </div>
        <div className="ct-log-time-field__time">
          <LogTimePicker
            key={`${timeId}-${formEpoch}`}
            id={timeId}
            aria-label={label}
            value={timeValue || ""}
            onChange={onTimeChange}
            allowClear={!required}
            invalid={!!fieldError}
            aria-describedby={fieldError ? `${timeId}-hint` : undefined}
          />
        </div>
      </div>
      <div className="ct-log-time-field__hint-layer" aria-hidden={!fieldError}>
        {fieldError ? (
          <LogTimeFieldHint error={fieldError} id={`${timeId}-hint`} />
        ) : null}
      </div>
    </div>
  );
}
