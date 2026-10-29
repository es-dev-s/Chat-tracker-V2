/** Broadcast topic for WhatsApp Audit changes. Payload carries ids only; clients refetch through the scoped API. */
export const WHATSAPP_AUDIT_REALTIME_TOPIC = "chat-tracker-whatsapp-audit";
export const WHATSAPP_AUDIT_REALTIME_EVENT = "audit_changed";

export type WhatsAppAuditRealtimeEvent = {
  op: "created" | "updated" | "deleted";
  id: number;
};
