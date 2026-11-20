/** Broadcast topic for Payment Record changes. Payload carries ids only; clients refetch through the scoped API. */
export const PAYMENT_RECORD_REALTIME_TOPIC = "chat-tracker-payment-records";
export const PAYMENT_RECORD_REALTIME_EVENT = "payment_changed";

export type PaymentRecordRealtimeEvent = {
  op: "created" | "updated" | "deleted";
  id: number;
};
