"use client";

import { useEffect } from "react";
import { useWhatsAppAuditStore } from "@/store/whatsapp-audit-store";

const POLL_MS = 30_000;

/**
 * Loads WhatsApp Audit entries for the signed-in user and keeps them fresh:
 * realtime broadcasts (SupabaseRealtimeBridge) trigger refetches; this hook
 * adds a 30s poll while the tab is visible and a refetch on focus as fallback.
 */
export function useWhatsAppAudits(userId: string | number | undefined | null) {
  const owner = userId == null ? "" : String(userId);

  useEffect(() => {
    if (!owner) return;
    const store = useWhatsAppAuditStore.getState();
    store.setOwner(owner);
    void store.refresh();

    const tick = () => {
      if (document.visibilityState === "visible") void useWhatsAppAuditStore.getState().refresh();
    };
    const timer = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [owner]);

  return useWhatsAppAuditStore();
}
