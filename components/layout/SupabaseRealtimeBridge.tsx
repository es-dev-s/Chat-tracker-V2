"use client";

import { useEffect, useRef } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import {
  ACK_REALTIME_EVENT,
  ACK_REALTIME_TOPIC,
} from "@/lib/realtime/acknowledgement-channel";
import {
  REPLY_TIMING_REALTIME_EVENT,
  REPLY_TIMING_REALTIME_TOPIC,
} from "@/lib/realtime/reply-timing-channel";
import { normalizeReplyTiming } from "@/lib/records/reply-timing";
import { useWorkspaceStore } from "@/store/workspace-store";

type RealtimeNode = {
  id: "primary" | "secondary";
  url: string;
  anonKey: string;
};

type AcknowledgementPayload = {
  id?: number;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
};

type ReplyTimingPayload = {
  id?: number;
  replyTiming?: string | null;
};

function readRealtimeNodes(url?: string, anonKey?: string): RealtimeNode[] {
  const nodes: RealtimeNode[] = [];
  const primaryUrl = (url || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const primaryKey = (anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (primaryUrl && primaryKey) {
    nodes.push({ id: "primary", url: primaryUrl, anonKey: primaryKey });
  }
  const secondaryUrl = process.env.NEXT_PUBLIC_SUPABASE_URL_SECONDARY?.trim();
  const secondaryKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_SECONDARY?.trim();
  if (secondaryUrl && secondaryKey) {
    nodes.push({ id: "secondary", url: secondaryUrl, anonKey: secondaryKey });
  }
  return nodes;
}

function applyAcknowledgement(payload: AcknowledgementPayload | undefined) {
  const id = Number(payload?.id);
  if (!Number.isFinite(id) || id <= 0) return;
  useWorkspaceStore
    .getState()
    .patchRecordAcknowledgement(
      id,
      payload?.acknowledgedAt ?? null,
      payload?.acknowledgedBy ?? null,
    );
}

function applyReplyTiming(payload: ReplyTimingPayload | undefined) {
  const id = Number(payload?.id);
  if (!Number.isFinite(id) || id <= 0) return;
  // Unknown / empty payloads become null (safe before migration too).
  useWorkspaceStore
    .getState()
    .patchRecordReplyTiming(id, normalizeReplyTiming(payload?.replyTiming));
}

/**
 * Paints acknowledgement and reply-timing changes on every open screen as
 * soon as another session saves them (Supabase broadcast; no DB publication).
 */
export default function SupabaseRealtimeBridge({
  url,
  anonKey,
}: {
  url?: string;
  anonKey?: string;
}) {
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const clientRef = useRef<SupabaseClient | null>(null);
  const nodeIndexRef = useRef(0);

  useEffect(() => {
    const nodes = readRealtimeNodes(url, anonKey);
    if (!nodes.length) return;

    let cancelled = false;

    const cleanup = () => {
      for (const ch of channelsRef.current) {
        void ch.unsubscribe();
      }
      channelsRef.current = [];
      clientRef.current = null;
    };

    const subscribe = (index: number) => {
      cleanup();
      const node = nodes[index];
      if (!node || cancelled) return;

      const client = createClient(node.url.replace(/\/+$/, ""), node.anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      clientRef.current = client;
      nodeIndexRef.current = index;

      const onChannelStatus = (status: string) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          const next = (nodeIndexRef.current + 1) % nodes.length;
          if (nodes.length > 1 && next !== nodeIndexRef.current) {
            subscribe(next);
          }
        }
      };

      const ackChannel = client
        .channel(ACK_REALTIME_TOPIC)
        .on("broadcast", { event: ACK_REALTIME_EVENT }, ({ payload }) => {
          applyAcknowledgement(payload as AcknowledgementPayload);
        })
        .subscribe(onChannelStatus);

      const replyChannel = client
        .channel(REPLY_TIMING_REALTIME_TOPIC)
        .on("broadcast", { event: REPLY_TIMING_REALTIME_EVENT }, ({ payload }) => {
          applyReplyTiming(payload as ReplyTimingPayload);
        })
        .subscribe(onChannelStatus);

      channelsRef.current = [ackChannel, replyChannel];
    };

    subscribe(0);

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [url, anonKey]);

  return null;
}
