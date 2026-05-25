"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { TimePicker12Hour } from "@/components/time-picker/time-picker-12hour";
import { dateToStoredTime, storedTimeToDate } from "@/lib/utils/time-input";

export type CtTimeInputHandle = {
  focusStart: () => void;
};

/** Stores HH:MM:SS strings — segmented 12-hour picker with AM/PM toggle. */
const CtTimeInput = forwardRef<
  CtTimeInputHandle,
  {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    onComplete?: () => void;
    "aria-label"?: string;
  }
>(function CtTimeInput(
  { value, onChange, disabled = false, onComplete, "aria-label": ariaLabel },
  ref,
) {
  const [date, setDate] = useState(() => storedTimeToDate(value));
  const [touched, setTouched] = useState(() => Boolean(String(value ?? "").trim()));
  const pickerRef = useRef<{ focusHour: () => void }>(null);

  useEffect(() => {
    setDate(storedTimeToDate(value));
    setTouched(Boolean(String(value ?? "").trim()));
  }, [value]);

  useImperativeHandle(ref, () => ({
    focusStart() {
      pickerRef.current?.focusHour();
    },
  }));

  const handleSetDate = (next: Date) => {
    if (!next) {
      setTouched(false);
      setDate(storedTimeToDate(""));
      onChange("");
      return;
    }
    setTouched(true);
    next.setSeconds(0, 0);
    setDate(next);
    onChange(dateToStoredTime(next));
  };

  const handlePeriodSetDate = (next: Date) => {
    if (!touched || !next) return;
    next.setSeconds(0, 0);
    setDate(next);
    onChange(dateToStoredTime(next));
  };

  const handleComplete = () => {
    if (!touched) return;
    onComplete?.();
  };

  return (
    <div style={{ width: "100%", minWidth: 0 }} aria-label={ariaLabel}>
      <TimePicker12Hour
        ref={pickerRef}
        date={date}
        setDate={handleSetDate}
        setDateFromPeriod={handlePeriodSetDate}
        disabled={disabled}
        canCommit={touched}
        onComplete={handleComplete}
      />
    </div>
  );
});

export default CtTimeInput;
