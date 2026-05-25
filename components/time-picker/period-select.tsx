"use client";

import * as React from "react";
import { display12HourValue, setDateByType, type Period } from "@/lib/time-picker-utils";

export const TimePeriodSelect = React.forwardRef<
  HTMLButtonElement,
  {
    period: Period;
    setPeriod: (value: Period) => void;
    date: Date;
    setDate: (date: Date) => void;
    onLeftFocus?: () => void;
    onComplete?: () => void;
    disabled?: boolean;
    canCommit?: boolean;
  }
>(function TimePeriodSelect(
  { period, setPeriod, date, setDate, onLeftFocus, onComplete, disabled, canCommit = false },
  ref,
) {
  const pmRef = React.useRef<HTMLButtonElement>(null);

  const finish = React.useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  const applyPeriod = (value: Period, advance = false) => {
    setPeriod(value);
    if (canCommit && date) {
      const tempDate = new Date(date);
      const hours = display12HourValue(date.getHours());
      setDate(setDateByType(tempDate, String(hours), "12hours", value));
    }
    if (advance && canCommit) {
      requestAnimationFrame(() => finish());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab" && !e.shiftKey && period === "PM" && canCommit) {
      finish();
      return;
    }
    if (e.key === "ArrowLeft" && period === "PM") {
      e.preventDefault();
      applyPeriod("AM");
      if (typeof ref === "object" && ref?.current) ref.current.focus();
      return;
    }
    if (e.key === "ArrowLeft" && period === "AM") {
      e.preventDefault();
      onLeftFocus?.();
      return;
    }
    if (e.key === "ArrowRight" && period === "AM") {
      e.preventDefault();
      applyPeriod("PM");
      pmRef.current?.focus();
      return;
    }
    if (e.key === "ArrowRight" && period === "PM" && canCommit) {
      e.preventDefault();
      finish();
      return;
    }
    if (/^[aA]$/.test(e.key) && canCommit) {
      e.preventDefault();
      applyPeriod("AM", true);
      return;
    }
    if (/^[pP]$/.test(e.key) && canCommit) {
      e.preventDefault();
      applyPeriod("PM", true);
    }
  };

  return (
    <div className="ct-time-period" onKeyDown={handleKeyDown}>
      {(["AM", "PM"] as const).map((value) => (
        <button
          key={value}
          ref={value === "AM" ? ref : pmRef}
          type="button"
          disabled={disabled}
          className="ct-time-period-btn"
          data-active={period === value}
          onClick={() => applyPeriod(value, true)}
          aria-pressed={period === value}
          aria-label={value}
        >
          {value}
        </button>
      ))}
    </div>
  );
});
