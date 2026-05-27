/** Client-only: workspace sync coordination after mutations and realtime events. */
export const WORKSPACE_SYNC_EVENT = "ct:workspace-sync";

export type WorkspaceSyncDetail = {
  forceFull?: boolean;
  fresh?: boolean;
};

type SyncWaiter = {
  resolve: () => void;
  reject: (err: Error) => void;
};

const waiters: SyncWaiter[] = [];
const SYNC_TIMEOUT_MS = 45_000;

let timeoutId: ReturnType<typeof setTimeout> | null = null;

function armSyncTimeout() {
  if (timeoutId != null) return;
  timeoutId = setTimeout(() => {
    timeoutId = null;
    const err = new Error("Workspace sync timed out");
    const batch = waiters.splice(0, waiters.length);
    for (const w of batch) w.reject(err);
  }, SYNC_TIMEOUT_MS);
}

function clearSyncTimeout() {
  if (timeoutId != null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

/** Resolve all callers waiting on a fresh workspace reload. */
export function completeWorkspaceSyncWaiters(): void {
  clearSyncTimeout();
  const batch = waiters.splice(0, waiters.length);
  for (const w of batch) w.resolve();
}

/** Reject all callers waiting on a fresh workspace reload. */
export function failWorkspaceSyncWaiters(error: Error): void {
  clearSyncTimeout();
  const batch = waiters.splice(0, waiters.length);
  for (const w of batch) w.reject(error);
}

/**
 * Request a workspace reload. When `fresh` is true, returns a promise that settles
 * after the server snapshot is applied (or the sync attempt finishes).
 */
export function requestWorkspaceSync(
  forceFull = true,
  fresh = true,
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (fresh) {
      waiters.push({ resolve, reject });
      armSyncTimeout();
    }
    window.dispatchEvent(
      new CustomEvent<WorkspaceSyncDetail>(WORKSPACE_SYNC_EVENT, {
        detail: { forceFull, fresh },
      }),
    );
    if (!fresh) resolve();
  });
}
