import {
  WHATSAPP_AUDIT_REALTIME_EVENT,
  WHATSAPP_AUDIT_REALTIME_TOPIC,
  type WhatsAppAuditRealtimeEvent,
} from "./whatsapp-audit-channel";

/**
 * Tell open screens that an audit row changed. Only the id and operation are
 * sent (no row data), so the public channel never leaks entries; each screen
 * refetches through the role-scoped API.
 */
export async function publishWhatsAppAuditChange(event: WhatsAppAuditRealtimeEvent): Promise<void> {
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
          topic: WHATSAPP_AUDIT_REALTIME_TOPIC,
          event: WHATSAPP_AUDIT_REALTIME_EVENT,
          payload: { op: event.op, id: event.id },
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`whatsapp-audit broadcast failed (${res.status})`);
}
