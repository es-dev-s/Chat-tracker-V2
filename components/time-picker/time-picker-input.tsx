"use client";

import * as React from "react";
import {
  getArrowByType,
  getDateByType,
  setDateByType,
  type Period,
  type TimePickerType,
} from "@/lib/time-picker-utils";

export const TimePickerInput = React.forwardRef<
  HTMLInputElement,
  {
    date?: Date;
    setDate: (date: Date) => void;
    picker: TimePickerType;
    period?: Period;
    onLeftFocus?: () => void;
    onRightFocus?: () => void;
    disabled?: boolean;
    className?: string;
  }
>(function TimePickerInput(
  {
    date = new Date(new Date().setHours(0, 0, 0, 0)),
    setDate,
    picker,
    period,
    onLeftFocus,
    onRightFocus,
    disabled,
    className = "ct-time-segment",
    ...props
  },
  ref,
) {
  const [flag, setFlag] = React.useState(false);
  const [prevIntKey, setPrevIntKey] = React.useState("0");

  React.useEffect(() => {
    if (!flag) return undefined;
    const timer = setTimeout(() => setFlag(false), 2000);
    return () => clearTimeout(timer);
  }, [flag]);

  const calculatedValue = React.useMemo(() => getDateByType(date, picker), [date, picker]);

  const calculateNewValue = (key: string) => {
    if (picker === "12hours") {
      if (flag && calculatedValue.slice(1, 2) === "1" && prevIntKey === "0") {
        return `0${key}`;
      }
    }
    return !flag ? `0${key}` : calculatedValue.slice(1, 2) + key;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") return;
    e.preventDefault();
    if (e.key === "ArrowRight") onRightFocus?.();
    if (e.key === "ArrowLeft") onLeftFocus?.();
    if (["ArrowUp", "ArrowDown"].includes(e.key)) {
      const step = e.key === "ArrowUp" ? 1 : -1;
      const newValue = getArrowByType(calculatedValue, step, picker);
      if (flag) setFlag(false);
      const tempDate = new Date(date);
      setDate(setDateByType(tempDate, newValue, picker, period));
    }
    if (e.key >= "0" && e.key <= "9") {
      if (picker === "12hours") setPrevIntKey(e.key);
      const newValue = calculateNewValue(e.key);
      const willAdvance = flag;
      if (willAdvance) onRightFocus?.();
      setFlag((prev) => !prev);
      const tempDate = new Date(date);
      setDate(setDateByType(tempDate, newValue, picker, period));
    }
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      className={className}
      value={calculatedValue}
      readOnly={false}
      onChange={() => {}}
      onFocus={() => setFlag(false)}
      onKeyDown={handleKeyDown}
      aria-label={picker === "12hours" ? "Hour" : "Minute"}
      {...props}
    />
  );
});
