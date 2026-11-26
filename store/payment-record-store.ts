"use client";

import { create } from "zustand";
import type { PaymentRecord } from "@/lib/payment-records/types";

/**
 * Client cache for Payment Records (separate from the workspace records).
 * Loaded from GET /api/payment-records (already role-scoped on the server) and
 * kept fresh by realtime broadcasts plus a light poll.
 */
type Status = "idle" | "loading" | "ready" | "error";

type PaymentState = {
  ownerId: string;
  records: PaymentRecord[];
  status: Status;
  error: string;
  schemaMissing: boolean;
  setOwner: (ownerId: string) => void;
  refresh: () => Promise<void>;
  upsert: (record: PaymentRecord) => void;
  remove: (id: number) => void;
};

function sortRecords(list: PaymentRecord[]): PaymentRecord[] {
  return [...list].sort((a, b) =>
    a.paymentDate === b.paymentDate ? b.id - a.id : a.paymentDate < b.paymentDate ? 1 : -1,
  );
}

let fetchSeq = 0;
let inflight: Promise<void> | null = null;
let queuedAgain = false;

export const usePaymentRecordStore = create<PaymentState>((set, get) => ({
  ownerId: "",
  records: [],
  status: "idle",
  error: "",
  schemaMissing: false,

  setOwner: (ownerId) => {
    if (get().ownerId === ownerId) return;
    fetchSeq += 1; // drop any response for the previous user
    set({ ownerId, records: [], status: "idle", error: "", schemaMissing: false });
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
      if (first) set({ status: "loading" });
      try {
        const res = await fetch("/api/payment-records", { credentials: "include", cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (seq !== fetchSeq) return;
        if (!res.ok) {
          set({
            schemaMissing: body?.error === "DATABASE_SCHEMA_OUTDATED",
            error: String(body?.message || body?.error || `Could not load payment records (${res.status}).`),
            status: get().records.length ? "ready" : "error",
          });
          return;
        }
        const list = Array.isArray(body?.records) ? (body.records as PaymentRecord[]) : [];
        set({ records: sortRecords(list), status: "ready", error: "", schemaMissing: false });
      } catch {
        if (seq !== fetchSeq) return;
        set({
          error: "Network error while loading payment records. Retrying automatically.",
          status: get().records.length ? "ready" : "error",
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

  upsert: (record) =>
    set((s) => {
      const idx = s.records.findIndex((r) => r.id === record.id);
      if (idx === -1) return { records: sortRecords([record, ...s.records]) };
      const next = s.records.slice();
      next[idx] = record;
      return { records: sortRecords(next) };
    }),

  remove: (id) => set((s) => ({ records: s.records.filter((r) => r.id !== id) })),
}));

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
/** Debounced refresh, used by realtime events. No-op until a screen has loaded records. */
export function requestPaymentRefresh(delayMs = 200) {
  if (usePaymentRecordStore.getState().status === "idle") return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void usePaymentRecordStore.getState().refresh();
  }, delayMs);
}
