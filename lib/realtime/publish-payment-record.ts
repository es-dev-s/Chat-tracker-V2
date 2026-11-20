import {
  PAYMENT_RECORD_REALTIME_EVENT,
  PAYMENT_RECORD_REALTIME_TOPIC,
  type PaymentRecordRealtimeEvent,
} from "./payment-record-channel";

/**
 * Tell open screens that a payment record changed. Only the id and operation are
 * sent (no row data), so the public channel never leaks records; each screen
 * refetches through the role-scoped API.
 */
export async function publishPaymentRecordChange(event: PaymentRecordRealtimeEvent): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key || !Number.isFinite(event.id)) return;

  const res = await fetch(`${url.replace(/\/+$/, "")}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          topic: PAYMENT_RECORD_REALTIME_TOPIC,
          event: PAYMENT_RECORD_REALTIME_EVENT,
          payload: { op: event.op, id: event.id },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`payment-record broadcast failed (${res.status})`);
}
