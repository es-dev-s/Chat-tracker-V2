"use client";

import { useCallback, useRef } from "react";
import type { CtTimeInputHandle } from "@/components/ui/CtTimeInput";

export const TIME_FIELD_KEYS = [
  "firstReceive",
  "firstReply",
  "clientLastReply",
  "analystLastReply",
] as const;

/** Manages auto-advance across the four log-chat time pickers. */
export function useChainedTimePickers({ isReady = true }: { isReady?: boolean } = {}) {
  const refs = useRef<(CtTimeInputHandle | null)[]>([]);

  const setRef = useCallback(
    (index: number) => (el: CtTimeInputHandle | null) => {
      refs.current[index] = el;
    },
    [],
  );

  const focusFirst = useCallback(() => {
    if (!isReady) return;
    refs.current[0]?.focusStart();
  }, [isReady]);

  const onComplete = useCallback(
    (index: number) => () => {
      refs.current[index + 1]?.focusStart();
    },
    [],
  );

  const handleTopSectionLeave = useCallback(() => {
    focusFirst();
  }, [focusFirst]);

  return {
    setRef,
    focusFirst,
    onComplete,
    handleTopSectionLeave,
    fieldCount: TIME_FIELD_KEYS.length,
  };
}
