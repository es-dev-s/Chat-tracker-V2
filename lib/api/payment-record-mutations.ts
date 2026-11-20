"use client";

import type {
  PaymentRecord,
  PaymentRecordFieldErrors,
  PaymentRecordInput,
} from "@/lib/payment-records/types";
import { useAuthStore } from "@/store/auth-store";
import { usePaymentRecordStore } from "@/store/payment-record-store";

export class PaymentApiError extends Error {
  code: string;
  status: number;
  fields: PaymentRecordFieldErrors;
  constructor(message: string, code: string, status: number, fields: PaymentRecordFieldErrors = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

async function toError(res: Response): Promise<PaymentApiError> {
  const body = await res.json().catch(() => ({}));
  const code = String(body?.error || "");
  const message =
    String(body?.message || "").trim() ||
    (code === "PAYMENT_CHANGE_FORBIDDEN" || code === "PAYMENT_ADD_FORBIDDEN"
      ? "You don't have permission to do this."
      : code === "NOT_FOUND"
        ? "This record no longer exists."
        : `Request failed (${res.status}).`);
  return new PaymentApiError(message, code, res.status, (body?.fields as PaymentRecordFieldErrors) || {});
}

async function send(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "include", ...init });
  } catch {
    throw new PaymentApiError("Network error. Check your connection and try again.", "NETWORK", 0);
  }
  if (res.status === 401) {
    void useAuthStore.getState().logout();
    throw new PaymentApiError("Session expired. Sign in again.", "UNAUTHORIZED", 401);
  }
  if (!res.ok) throw await toError(res);
  return res;
}

const json = { "Content-Type": "application/json" };

export async function createPaymentRecord(record: PaymentRecordInput): Promise<PaymentRecord> {
  const res = await send("/api/payment-records", {
    method: "POST",
    headers: json,
    body: JSON.stringify({ record }),
  });
  const saved = (await res.json()).record as PaymentRecord;
  usePaymentRecordStore.getState().upsert(saved);
  return saved;
}

export async function updatePaymentRecord(id: number, record: PaymentRecordInput): Promise<PaymentRecord> {
  const res = await send(`/api/payment-records/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    headers: json,
    body: JSON.stringify({ record }),
  });
  const saved = (await res.json()).record as PaymentRecord;
  usePaymentRecordStore.getState().upsert(saved);
  return saved;
}

export async function deletePaymentRecord(id: number): Promise<void> {
  const store = usePaymentRecordStore.getState();
  const prev = store.records.find((r) => r.id === id);
  store.remove(id);
  try {
    await send(`/api/payment-records/${encodeURIComponent(String(id))}`, { method: "DELETE" });
  } catch (err) {
    if (prev && !(err instanceof PaymentApiError && err.code === "NOT_FOUND")) {
      usePaymentRecordStore.getState().upsert(prev);
    }
    throw err;
  }
}
