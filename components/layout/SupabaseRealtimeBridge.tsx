"use client";

import { useEffect, useRef } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import {
  ACK_REALTIME_EVENT,
  ACK_REALTIME_TOPIC,
} from "@/lib/realtime/acknowledgement-channel";
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

/**
 * Paints acknowledgement changes on every open Records screen as soon as
 * another session saves them.
 */
export default function SupabaseRealtimeBridge({
  url,
  anonKey,
}: {
  url?: string;
  anonKey?: string;
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const nodeIndexRef = useRef(0);

  useEffect(() => {
    const nodes = readRealtimeNodes(url, anonKey);
    if (!nodes.length) return;

    let cancelled = false;

    const cleanup = () => {
      if (channelRef.current) {
        void channelRef.current.unsubscribe();
        channelRef.current = null;
      }
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

      const channel = client
        .channel(ACK_REALTIME_TOPIC)
        .on("broadcast", { event: ACK_REALTIME_EVENT }, ({ payload }) => {
          applyAcknowledgement(payload as AcknowledgementPayload);
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            const next = (nodeIndexRef.current + 1) % nodes.length;
            if (nodes.length > 1 && next !== nodeIndexRef.current) {
              subscribe(next);
            }
          }
        });

      channelRef.current = channel;
    };

    subscribe(0);

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [url, anonKey]);

  return null;
}
