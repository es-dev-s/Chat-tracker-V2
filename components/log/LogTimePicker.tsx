"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import LogTimeUnitSelect from "@/components/log/LogTimeUnitSelect";
import {
  formatStoredTimeDisplay,
  parts12ToStoredTime,
  storedTimeTo12Parts,
  type StoredTime12Parts,
} from "@/lib/utils/time-input";

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const v = String(i + 1);
  return { value: v, label: v };
});

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => {
  const v = String(i).padStart(2, "0");
  return { value: v, label: v };
});

type Period = StoredTime12Parts["period"] | "";

function partsComplete(
  hour12: string,
  minute: string,
  period: Period,
): period is StoredTime12Parts["period"] {
  return Boolean(hour12 && minute && period);
}

export default function LogTimePicker({
  id,
  value,
  onChange,
  allowClear = true,
  invalid = false,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const parsed = useMemo(() => storedTimeTo12Parts(value), [value]);
  const [hour12, setHour12] = useState(() => parsed?.hour12 ?? "");
  const [minute, setMinute] = useState(() => parsed?.minute ?? "");
  const [period, setPeriod] = useState<Period>(() => parsed?.period ?? "");

  const complete = partsComplete(hour12, minute, period);
  const incomplete = Boolean(hour12 || minute || period) && !complete;
  const displayTime = complete ? formatStoredTimeDisplay(value) : "";

  const emit = (h: string, m: string, p: Period) => {
    if (!h && !m && !p) {
      onChange("");
      return;
    }
    if (partsComplete(h, m, p)) {
      onChange(parts12ToStoredTime(h, m, p));
    }
  };

  const setHour = (h: string) => {
    setHour12(h);
    emit(h, minute, period);
  };

  const setMin = (m: string) => {
    setMinute(m);
    emit(hour12, m, period);
  };

  const setPeriodValue = (p: StoredTime12Parts["period"]) => {
    setPeriod(p);
    emit(hour12, minute, p);
  };

  const clear = () => {
    setHour12("");
    setMinute("");
    setPeriod("");
    onChange("");
  };

  return (
    <div
      id={id}
      className={`ct-log-time-picker${complete ? " ct-log-time-picker--complete" : ""}${incomplete ? " ct-log-time-picker--incomplete" : ""}${invalid ? " ct-log-time-picker--invalid" : ""}`}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      aria-describedby={ariaDescribedBy}
      title={incomplete ? "Select hour, minute, and AM or PM" : undefined}
    >
      {displayTime ? (
        <span className="ct-log-time-picker__badge" aria-hidden>
          {displayTime}
        </span>
      ) : null}
      <div className="ct-log-time-bar">
        <div className="ct-log-time-bar__clock">
          <LogTimeUnitSelect
            kind="hour"
            aria-label={`${ariaLabel ?? "Time"} hour`}
            value={hour12}
            onChange={setHour}
            placeholder="Hr"
            options={HOUR_OPTIONS}
          />
          <span className="ct-log-time-bar__colon" aria-hidden>
            :
          </span>
          <LogTimeUnitSelect
            kind="minute"
            aria-label={`${ariaLabel ?? "Time"} minute`}
            value={minute}
            onChange={setMin}
            placeholder="Min"
            options={MINUTE_OPTIONS}
          />
        </div>

        <div
          className="ct-log-time-bar__period"
          role="group"
          aria-label={`${ariaLabel ?? "Time"} AM or PM`}
        >
          {(["AM", "PM"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className="ct-log-time-bar__period-btn"
              data-active={period === p}
              aria-pressed={period === p}
              onClick={() => setPeriodValue(p)}
            >
              {p}
            </button>
          ))}
        </div>

        {allowClear && (hour12 || minute || period) ? (
          <button
            type="button"
            className="ct-log-time-bar__clear"
            aria-label={`Clear ${ariaLabel ?? "time"}`}
            onClick={clear}
          >
            <X size={13} strokeWidth={2.25} aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
