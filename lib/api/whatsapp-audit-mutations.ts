"use client";

import type { ReplyTiming } from "@/lib/records/reply-timing";
import type {
  WhatsAppAudit,
  WhatsAppAuditFieldErrors,
  WhatsAppAuditInput,
} from "@/lib/whatsapp-audit/types";
import { useAuthStore } from "@/store/auth-store";
import {
  clearPendingAuditCategory,
  setPendingAuditCategory,
  useWhatsAppAuditStore,
} from "@/store/whatsapp-audit-store";

export class AuditApiError extends Error {
  code: string;
  status: number;
  fields: WhatsAppAuditFieldErrors;
  constructor(message: string, code: string, status: number, fields: WhatsAppAuditFieldErrors = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

async function toError(res: Response): Promise<AuditApiError> {
  const body = await res.json().catch(() => ({}));
  const code = String(body?.error || "");
  const message =
    String(body?.message || "").trim() ||
    (code === "AUDIT_DELETE_FORBIDDEN" || code === "FIELD_FORBIDDEN"
      ? "You don't have permission to change this entry."
      : code === "NOT_FOUND"
        ? "This entry no longer exists."
        : `Request failed (${res.status}).`);
  return new AuditApiError(message, code, res.status, (body?.fields as WhatsAppAuditFieldErrors) || {});
}

async function send(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "include", ...init });
  } catch {
    throw new AuditApiError("Network error. Check your connection and try again.", "NETWORK", 0);
  }
  if (res.status === 401) {
    void useAuthStore.getState().logout();
    throw new AuditApiError("Session expired. Sign in again.", "UNAUTHORIZED", 401);
  }
  if (!res.ok) throw await toError(res);
  return res;
}

const json = { "Content-Type": "application/json" };

export async function createWhatsAppAudit(audit: WhatsAppAuditInput): Promise<WhatsAppAudit> {
  const res = await send("/api/whatsapp-audits", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ audit }),
  });
  const saved = (await res.json()).audit as WhatsAppAudit;
  useWhatsAppAuditStore.getState().upsert(saved);
  return saved;
}

export async function updateWhatsAppAudit(id: number, audit: WhatsAppAuditInput): Promise<WhatsAppAudit> {
  const res = await send(`/api/whatsapp-audits/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    headers: json,
    body: JSON.stringify({ audit }),
  });
  const saved = (await res.json()).audit as WhatsAppAudit;
  useWhatsAppAuditStore.getState().upsert(saved);
  return saved;
}

export async function deleteWhatsAppAudit(id: number): Promise<void> {
  const store = useWhatsAppAuditStore.getState();
  const prev = store.audits.find((a) => a.id === id);
  store.remove(id);
  try {
    await send(`/api/whatsapp-audits/${encodeURIComponent(String(id))}`, { method: "DELETE" });
  } catch (err) {
    if (prev && !(err instanceof AuditApiError && err.code === "NOT_FOUND")) {
      useWhatsAppAuditStore.getState().upsert(prev);
    }
    throw err;
  }
}

type CategoryQueue = { latest: number; confirmed: ReplyTiming | null; chain: Promise<unknown> };
const categoryQueues = new Map<number, CategoryQueue>();

/**
 * Optimistic, race-safe category save (same model as Records reply timing):
 * rapid picks on one row are serialized and coalesced so only the newest pick
 * is sent, a stale response never overwrites a newer pick, and a failure rolls
 * back to the last confirmed value. Resolves to null when superseded.
 */
export function patchWhatsAppAuditCategory(
  id: number,
  category: ReplyTiming | null,
): Promise<WhatsAppAudit | null> {
  let queue = categoryQueues.get(id);
  if (!queue) {
    const prev = useWhatsAppAuditStore.getState().audits.find((a) => a.id === id);
    queue = { latest: 0, confirmed: prev?.category ?? null, chain: Promise.resolve() };
    categoryQueues.set(id, queue);
  }
  const q = queue;
  const version = ++q.latest;
  setPendingAuditCategory(id, category);
  useWhatsAppAuditStore.getState().setCategory(id, category);

  const run = q.chain.then(async (): Promise<WhatsAppAudit | null> => {
    if (version !== q.latest) return null;
    const res = await send(`/api/whatsapp-audits/${encodeURIComponent(String(id))}/category`, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ category }),
    });
    const saved = (await res.json()).audit as WhatsAppAudit;
    q.confirmed = saved.category ?? null;
    return saved;
  });
  q.chain = run.catch(() => undefined);

  const settle = () => {
    if (version !== q.latest) return false;
    categoryQueues.delete(id);
    clearPendingAuditCategory(id);
    return true;
  };

  return run.then(
    (saved) => {
      if (settle()) {
        if (saved) useWhatsAppAuditStore.getState().upsert(saved);
        else useWhatsAppAuditStore.getState().setCategory(id, q.confirmed);
      }
      return saved;
    },
    (err) => {
      if (settle()) useWhatsAppAuditStore.getState().setCategory(id, q.confirmed);
      throw err;
    },
  );
}
