"use client";

import { create } from "zustand";
import type { ReplyTiming } from "@/lib/records/reply-timing";
import type { WhatsAppAudit } from "@/lib/whatsapp-audit/types";

/**
 * Client cache for WhatsApp Audit entries (separate from the workspace records).
 * Loaded from GET /api/whatsapp-audits (already role-scoped on the server) and
 * kept fresh by realtime broadcasts plus a light poll.
 */
type Status = "idle" | "loading" | "ready" | "error";

type AuditState = {
  ownerId: string;
  audits: WhatsAppAudit[];
  status: Status;
  error: string;
  schemaMissing: boolean;
  refreshing: boolean;
  setOwner: (ownerId: string) => void;
  refresh: () => Promise<void>;
  upsert: (audit: WhatsAppAudit) => void;
  remove: (id: number) => void;
  setCategory: (id: number, category: ReplyTiming | null) => void;
};

/** Category picks still being saved on this screen; a refetch must not repaint them back. */
const pendingCategories = new Map<number, ReplyTiming | null>();
export function setPendingAuditCategory(id: number, category: ReplyTiming | null) {
  pendingCategories.set(id, category);
}
export function clearPendingAuditCategory(id: number) {
  pendingCategories.delete(id);
}
export function hasPendingAuditCategory(id: number) {
  return pendingCategories.has(id);
}

function sortAudits(list: WhatsAppAudit[]): WhatsAppAudit[] {
  return [...list].sort((a, b) =>
    a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1,
  );
}

function overlayPending(list: WhatsAppAudit[]): WhatsAppAudit[] {
  if (!pendingCategories.size) return list;
  return list.map((a) =>
    pendingCategories.has(a.id) ? { ...a, category: pendingCategories.get(a.id) ?? null } : a,
  );
}

let fetchSeq = 0;
let inflight: Promise<void> | null = null;
let queuedAgain = false;

export const useWhatsAppAuditStore = create<AuditState>((set, get) => ({
  ownerId: "",
  audits: [],
  status: "idle",
  error: "",
  schemaMissing: false,
  refreshing: false,

  setOwner: (ownerId) => {
    if (get().ownerId === ownerId) return;
    fetchSeq += 1; // drop any response for the previous user
    pendingCategories.clear();
    set({ ownerId, audits: [], status: "idle", error: "", schemaMissing: false });
  },

  refresh: async () => {
    // Coalesce bursts (realtime + focus + poll): at most one request in flight
    // and one follow-up queued behind it.
    if (inflight) {
      queuedAgain = true;
      return inflight;
    }
    const run = async () => {
      const seq = ++fetchSeq;
      const first = get().status === "idle" || get().status === "error";
      set(first ? { status: "loading", refreshing: true } : { refreshing: true });
      try {
        const res = await fetch("/api/whatsapp-audits", {
          credentials: "include",
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));
        if (seq !== fetchSeq) return;
        if (!res.ok) {
          const schemaMissing = body?.error === "DATABASE_SCHEMA_OUTDATED";
          set({
            refreshing: false,
            schemaMissing,
            error: String(body?.message || body?.error || `Could not load audits (${res.status}).`),
            status: get().audits.length ? "ready" : "error",
          });
          return;
        }
        const list = Array.isArray(body?.audits) ? (body.audits as WhatsAppAudit[]) : [];
        set({
          audits: overlayPending(sortAudits(list)),
          status: "ready",
          error: "",
          schemaMissing: false,
          refreshing: false,
        });
      } catch {
        if (seq !== fetchSeq) return;
        set({
          refreshing: false,
          error: "Network error while loading audits. Retrying automatically.",
          status: get().audits.length ? "ready" : "error",
        });
      }
    };
    inflight = (async () => {
      try {
        do {
          queuedAgain = false;
          await run();
        } while (queuedAgain);
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  },

  upsert: (audit) =>
    set((s) => {
      const merged = pendingCategories.has(audit.id)
        ? { ...audit, category: pendingCategories.get(audit.id) ?? null }
        : audit;
      const idx = s.audits.findIndex((a) => a.id === audit.id);
      if (idx === -1) return { audits: sortAudits([merged, ...s.audits]) };
      const next = s.audits.slice();
      next[idx] = merged;
      return { audits: s.audits[idx].date === merged.date ? next : sortAudits(next) };
    }),

  remove: (id) => set((s) => ({ audits: s.audits.filter((a) => a.id !== id) })),

  setCategory: (id, category) =>
    set((s) => {
      const idx = s.audits.findIndex((a) => a.id === id);
      if (idx === -1 || s.audits[idx].category === category) return s;
      const next = s.audits.slice();
      next[idx] = { ...next[idx], category };
      return { audits: next };
    }),
}));

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
/** Debounced refresh, used by realtime events. No-op until a screen has loaded audits. */
export function requestAuditRefresh(delayMs = 200) {
  if (useWhatsAppAuditStore.getState().status === "idle") return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void useWhatsAppAuditStore.getState().refresh();
  }, delayMs);
}
