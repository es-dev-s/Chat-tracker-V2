import {
  REPLY_TIMING_REALTIME_EVENT,
  REPLY_TIMING_REALTIME_TOPIC,
} from "./reply-timing-channel";

export type ReplyTimingEvent = {
  id: number;
  replyTiming: string | null;
};

/** Push one reply-timing change to every open workspace screen. */
export async function publishRecordReplyTiming(
  event: ReplyTimingEvent,
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
          topic: REPLY_TIMING_REALTIME_TOPIC,
          event: REPLY_TIMING_REALTIME_EVENT,
          payload: {
            id: event.id,
            replyTiming: event.replyTiming,
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`reply-timing broadcast failed (${res.status})`);
  }
}
