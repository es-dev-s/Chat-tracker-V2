"use client";

import * as React from "react";
import { TimePickerInput } from "./time-picker-input";
import { TimePeriodSelect } from "./period-select";

export const TimePicker12Hour = React.forwardRef<
  { focusHour: () => void },
  {
    date: Date;
    setDate: (date: Date) => void;
    setDateFromPeriod?: (date: Date) => void;
    disabled?: boolean;
    canCommit?: boolean;
    onComplete?: () => void;
  }
>(function TimePicker12Hour(
  {
    date,
    setDate,
    setDateFromPeriod,
    disabled = false,
    canCommit = false,
    onComplete,
  },
  ref,
) {
  const [period, setPeriod] = React.useState<"AM" | "PM">(
    date.getHours() >= 12 ? "PM" : "AM",
  );

  const minuteRef = React.useRef<HTMLInputElement>(null);
  const hourRef = React.useRef<HTMLInputElement>(null);
  const periodRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    setPeriod(date.getHours() >= 12 ? "PM" : "AM");
  }, [date]);

  React.useImperativeHandle(ref, () => ({
    focusHour() {
      hourRef.current?.focus();
    },
  }));

  const applyPeriodDate = setDateFromPeriod || setDate;

  return (
    <div className="ct-time-field" data-disabled={disabled ? "true" : "false"}>
      <TimePickerInput
        picker="12hours"
        date={date}
        setDate={setDate}
        period={period}
        disabled={disabled}
        ref={hourRef}
        onRightFocus={() => minuteRef.current?.focus()}
      />
      <span className="ct-time-colon" aria-hidden>
        :
      </span>
      <TimePickerInput
        picker="minutes"
        date={date}
        setDate={setDate}
        disabled={disabled}
        ref={minuteRef}
        onLeftFocus={() => hourRef.current?.focus()}
        onRightFocus={() => periodRef.current?.focus()}
      />
      <TimePeriodSelect
        period={period}
        setPeriod={setPeriod}
        date={date}
        setDate={applyPeriodDate}
        disabled={disabled}
        canCommit={canCommit}
        ref={periodRef}
        onLeftFocus={() => minuteRef.current?.focus()}
        onComplete={onComplete}
      />
    </div>
  );
});
