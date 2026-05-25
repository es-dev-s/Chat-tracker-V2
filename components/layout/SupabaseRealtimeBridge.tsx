"use client";

import { useEffect, useRef } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { requestWorkspaceSync } from "@/lib/workspace/sync-events";

type RealtimeNode = {
  id: "primary" | "secondary";
  url: string;
  anonKey: string;
};

function readRealtimeNodes(): RealtimeNode[] {
  const nodes: RealtimeNode[] = [];
  const primaryUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const primaryKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
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

/**
 * Optional Supabase Realtime bridge — instant workspace refresh on record changes.
 * Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (and secondary pair for failover).
 */
export default function SupabaseRealtimeBridge() {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const nodeIndexRef = useRef(0);

  useEffect(() => {
    const nodes = readRealtimeNodes();
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
        .channel(`ct-records-${node.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "chat_records" },
          () => {
            requestWorkspaceSync(false);
          },
        )
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
  }, []);

  return null;
}
