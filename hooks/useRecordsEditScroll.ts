"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  afterLayout,
  scrollContainerToElement,
  waitForElement,
} from "@/lib/utils/scroll-container";

type PendingReturn = {
  recordId: number;
  session: number;
};

/**
 * Smooth scroll between ledger rows and the top edit panel.
 * Session tokens discard stale work when the user clicks Update repeatedly.
 */
export function useRecordsEditScroll({
  editOpen,
  page,
  setPage,
  findRecordPage,
}: {
  editOpen: boolean;
  page: number;
  setPage: (page: number) => void;
  findRecordPage: (recordId: number) => number | null;
}) {
  const sessionRef = useRef(0);
  const editPanelRef = useRef<HTMLDivElement>(null);
  const pendingOpenSessionRef = useRef<number | null>(null);
  const pendingReturnRef = useRef<PendingReturn | null>(null);
  const [highlightRecordId, setHighlightRecordId] = useState<number | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
  }, []);

  const flashRow = useCallback(
    (recordId: number) => {
      clearHighlightTimer();
      setHighlightRecordId(recordId);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightRecordId(null);
        highlightTimerRef.current = null;
      }, 1600);
    },
    [clearHighlightTimer],
  );

  const scrollToPanel = useCallback(async (session: number) => {
    const panel = await waitForElement(() => editPanelRef.current);
    if (!panel || session !== sessionRef.current) return;
    afterLayout(() => {
      if (session !== sessionRef.current) return;
      scrollContainerToElement(panel, { offset: 10 });
    });
  }, []);

  const runReturnScroll = useCallback(async () => {
    const pending = pendingReturnRef.current;
    if (!pending || editOpen) return;

    const { recordId, session } = pending;
    if (session !== sessionRef.current) {
      pendingReturnRef.current = null;
      return;
    }

    const rowId = `ct-record-row-${recordId}`;
    let row = document.getElementById(rowId);

    if (!row?.isConnected) {
      const targetPage = findRecordPage(recordId);
      if (targetPage != null && targetPage !== page) {
        setPage(targetPage);
        return;
      }
      row = await waitForElement(() => document.getElementById(rowId));
    }

    if (!row || session !== sessionRef.current) {
      if (session !== sessionRef.current) pendingReturnRef.current = null;
      return;
    }

    pendingReturnRef.current = null;
    afterLayout(() => {
      if (session !== sessionRef.current) return;
      scrollContainerToElement(row!, { offset: 16 });
      flashRow(recordId);
    });
  }, [editOpen, findRecordPage, flashRow, page, setPage]);

  const notifyEditOpened = useCallback(() => {
    clearHighlightTimer();
    setHighlightRecordId(null);
    const session = ++sessionRef.current;
    pendingReturnRef.current = null;
    pendingOpenSessionRef.current = session;
  }, [clearHighlightTimer]);

  const notifyEditClosed = useCallback(
    (recordId: number) => {
      clearHighlightTimer();
      setHighlightRecordId(null);
      const session = ++sessionRef.current;
      pendingOpenSessionRef.current = null;
      pendingReturnRef.current = { recordId, session };
    },
    [clearHighlightTimer],
  );

  useLayoutEffect(() => {
    const session = pendingOpenSessionRef.current;
    if (!editOpen || session == null) return;
    pendingOpenSessionRef.current = null;
    void scrollToPanel(session);
  }, [editOpen, scrollToPanel]);

  useLayoutEffect(() => {
    if (editOpen) return;
    void runReturnScroll();
  }, [editOpen, page, runReturnScroll]);

  useLayoutEffect(
    () => () => {
      clearHighlightTimer();
    },
    [clearHighlightTimer],
  );

  return {
    editPanelRef,
    highlightRecordId,
    notifyEditOpened,
    notifyEditClosed,
  };
}
