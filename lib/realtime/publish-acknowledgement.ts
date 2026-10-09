import { ACK_REALTIME_EVENT, ACK_REALTIME_TOPIC } from "./acknowledgement-channel";

export type AcknowledgementEvent = {
  id: number;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
};

/** Push one acknowledgement change to every open Records screen. */
export async function publishRecordAcknowledgement(
  event: AcknowledgementEvent,
): Promise<void> {
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
          topic: ACK_REALTIME_TOPIC,
          event: ACK_REALTIME_EVENT,
          payload: {
            id: event.id,
            acknowledgedAt: event.acknowledgedAt,
            acknowledgedBy: event.acknowledgedBy,
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`acknowledgement broadcast failed (${res.status})`);
  }
}
