"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { SessionUser } from "@/lib/auth/constants";
import { notifUserKey } from "@/lib/auth/scoping";
import {
  WORKSPACE_BOOTSTRAP_RECORD_LIMIT,
  WORKSPACE_POLL_MS,
} from "@/lib/workspace/constants";
import { workspaceCacheKey } from "@/lib/workspace/cache";
import type { WorkspacePayload, WorkspaceVersionPayload } from "@/lib/workspace/cache";
import { WORKSPACE_SYNC_EVENT } from "@/lib/workspace/sync-events";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const DEBOUNCE_MS = 250;

type FetchResult =
  | { kind: "unauthorized" }
  | { kind: "unchanged" }
  | { kind: "version"; data: WorkspaceVersionPayload }
  | { kind: "full"; data: WorkspacePayload }
  | { kind: "bootstrap"; data: WorkspacePayload };

async function fetchWorkspaceBootstrap(): Promise<FetchResult> {
  const params = new URLSearchParams({
    bootstrap: "1",
    limit: String(WORKSPACE_BOOTSTRAP_RECORD_LIMIT),
  });

  const res = await fetch(`/api/workspace?${params}`, {
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 401 || res.status === 403) return { kind: "unauthorized" };
  if (!res.ok) return { kind: "unchanged" };

  const data = (await res.json()) as WorkspacePayload;
  return { kind: "bootstrap", data };
}

async function fetchWorkspaceVersion(
  currentVersion: string,
): Promise<FetchResult> {
  const params = new URLSearchParams({ mode: "version" });
  if (currentVersion) params.set("version", currentVersion);

  const res = await fetch(`/api/workspace?${params}`, {
    credentials: "include",
    cache: "no-store",
    headers: currentVersion ? { "If-None-Match": `"${currentVersion}"` } : {},
  });

  if (res.status === 401 || res.status === 403) return { kind: "unauthorized" };
  if (res.status === 304) return { kind: "unchanged" };
  if (!res.ok) return { kind: "unchanged" };

  const data = (await res.json()) as WorkspaceVersionPayload;
  if (currentVersion && data.version === currentVersion) return { kind: "unchanged" };
  return { kind: "version", data };
}

async function fetchWorkspaceFull(currentVersion: string): Promise<FetchResult> {
  const params = new URLSearchParams();
  if (currentVersion) params.set("version", currentVersion);

  const res = await fetch(
    params.size ? `/api/workspace?${params}` : "/api/workspace",
    {
      credentials: "include",
      cache: "no-store",
      headers: currentVersion ? { "If-None-Match": `"${currentVersion}"` } : {},
    },
  );

  if (res.status === 401 || res.status === 403) return { kind: "unauthorized" };
  if (res.status === 304) return { kind: "unchanged" };
  if (!res.ok) return { kind: "unchanged" };

  const data = (await res.json()) as WorkspacePayload;
  if (currentVersion && data.version === currentVersion) return { kind: "unchanged" };
  return { kind: "full", data };
}

/**
 * Cache-first workspace sync with server-prefetched bootstrap, fast version polls,
 * and background full history load.
 */
export default function WorkspaceSync({
  user,
  initialPayload = null,
}: {
  user: SessionUser;
  initialPayload?: WorkspacePayload | null;
}) {
  const bootstrapped = useRef(false);
  const seededServer = useRef(false);
  const syncing = useRef(false);
  const pending = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!bootstrapped.current) {
    const key = workspaceCacheKey(user);
    useWorkspaceStore.setState({ cacheKey: key, notifUserKey: notifUserKey(user) });
    const hadCache = useWorkspaceStore.getState().bootstrapFromCache(user);
    if (!hadCache && initialPayload) {
      useWorkspaceStore.getState().applyPayload(initialPayload, "network");
      seededServer.current = true;
    }
    bootstrapped.current = true;
  }

  useLayoutEffect(() => {
    if (seededServer.current || !initialPayload) return;
    if (!useWorkspaceStore.getState().ready) {
      useWorkspaceStore.getState().applyPayload(initialPayload, "network");
      seededServer.current = true;
    }
  }, [initialPayload]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const handleUnauthorized = () => {
      void useAuthStore.getState().logout();
    };

    const applyFull = (data: WorkspacePayload) => {
      useWorkspaceStore.getState().applyPayload(
        { ...data, recordsComplete: true },
        "network",
      );
    };

    const runSync = async (background: boolean, forceFull = false) => {
      if (syncing.current) {
        pending.current = true;
        return;
      }
      syncing.current = true;

      try {
        let state = useWorkspaceStore.getState();

        if (!state.ready) {
          const boot = await fetchWorkspaceBootstrap();
          if (cancelled) return;
          if (boot.kind === "unauthorized") {
            handleUnauthorized();
            return;
          }
          if (boot.kind === "bootstrap") {
            useWorkspaceStore.getState().applyPayload(boot.data, "network");
          }
          state = useWorkspaceStore.getState();
        }

        if (!state.ready) {
          const full = await fetchWorkspaceFull("");
          if (cancelled) return;
          if (full.kind === "unauthorized") {
            handleUnauthorized();
            return;
          }
          if (full.kind === "full") {
            applyFull(full.data);
          }
          return;
        }

        const needsFull = forceFull || !state.recordsComplete;
        if (needsFull) {
          if (!background && state.ready) {
            useWorkspaceStore.setState({ syncSource: "syncing" });
          }
          // Never send If-None-Match until history is complete — bootstrap shares
          // the same DB meta version but only carries the latest N rows.
          const versionForFetch = state.recordsComplete ? state.version : "";
          const full = await fetchWorkspaceFull(versionForFetch);
          if (cancelled) return;
          if (full.kind === "unauthorized") {
            handleUnauthorized();
            return;
          }
          if (full.kind === "full") {
            applyFull(full.data);
          } else if (full.kind === "unchanged" && state.recordsComplete) {
            useWorkspaceStore.getState().touchNetwork(state.version);
          }
          return;
        }

        const versionResult = await fetchWorkspaceVersion(state.version);
        if (cancelled) return;
        if (versionResult.kind === "unauthorized") {
          handleUnauthorized();
          return;
        }

        if (versionResult.kind === "version") {
          const full = await fetchWorkspaceFull("");
          if (cancelled) return;
          if (full.kind === "unauthorized") {
            handleUnauthorized();
            return;
          }
          if (full.kind === "full") {
            applyFull(full.data);
          } else {
            pending.current = true;
          }
          return;
        }

        if (versionResult.kind === "unchanged") {
          useWorkspaceStore.getState().touchNetwork(state.version);
        }
      } finally {
        syncing.current = false;
        if (pending.current) {
          pending.current = false;
          void runSync(true);
        }
      }
    };

    const scheduleSync = (background: boolean, forceFull = false) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        void runSync(background, forceFull);
      }, DEBOUNCE_MS);
    };

    void runSync(false, !useWorkspaceStore.getState().recordsComplete);

    let lastDbNode: string | null = null;
    const pollDbHealth = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/health/db", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { activeNode?: string | null };
        const node = body.activeNode ?? null;
        if (lastDbNode != null && node != null && node !== lastDbNode) {
          scheduleSync(false, true);
        }
        lastDbNode = node;
      } catch {
        //
      }
    };

    void pollDbHealth();
    const dbHealthTimer = setInterval(pollDbHealth, 20_000);

    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") scheduleSync(true);
    }, WORKSPACE_POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleSync(true);
    };
    const onReconnect = () => scheduleSync(false, true);
    const onMutationSync = (event: Event) => {
      const detail = (event as CustomEvent<{ forceFull?: boolean }>).detail;
      scheduleSync(true, Boolean(detail?.forceFull));
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onReconnect);
    window.addEventListener("focus", onReconnect);
    window.addEventListener(WORKSPACE_SYNC_EVENT, onMutationSync);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      clearInterval(dbHealthTimer);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onReconnect);
      window.removeEventListener("focus", onReconnect);
      window.removeEventListener(WORKSPACE_SYNC_EVENT, onMutationSync);
    };
  }, [user.id, user.email]);

  return null;
}
