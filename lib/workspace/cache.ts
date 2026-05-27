import type { SessionUser } from "@/lib/auth/constants";
import { normEmail } from "@/lib/db/users";
import type { ChatRecord } from "@/lib/db/records";

export type WorkspaceUser = Omit<
  SessionUser,
  "password"
> & {
  /** Present when the viewer is allowed to manage this user (team lead admin). */
  password?: string;
  name: string;
  teamNames: string[];
  teamName: string;
  profileNames: string[];
};

export type WorkspacePayload = {
  version: string;
  fetchedAt: number;
  records: ChatRecord[];
  users: WorkspaceUser[];
  teams: string[];
  profiles: string[];
  dismissedNotifs: Record<string, string[]>;
  notifUserKey: string;
  /** False when payload is a bootstrap slice; omitted/true for full workspace. */
  recordsComplete?: boolean;
};

/** Lightweight poll response — no record bodies. */
export type WorkspaceVersionPayload = {
  version: string;
  fetchedAt: number;
  dismissedNotifs: Record<string, string[]>;
  notifUserKey: string;
};

const CACHE_PREFIX = "ct-workspace-v1:";

export function workspaceCacheKey(user: Pick<SessionUser, "id" | "email">): string {
  return `${CACHE_PREFIX}${String(user.id)}:${normEmail(user.email)}`;
}

export function readWorkspaceCache(key: string): WorkspacePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspacePayload;
    if (!parsed || !Array.isArray(parsed.records)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeWorkspaceCache(key: string, payload: WorkspacePayload): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota exceeded — drop cache silently; live data still works
  }
}

export function clearAllWorkspaceCaches(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    //
  }
}

/** Drop persisted workspace snapshot for the active user (after mutations). */
export function invalidateWorkspaceClientCache(cacheKey: string | null): void {
  if (typeof window === "undefined" || !cacheKey) return;
  try {
    localStorage.removeItem(cacheKey);
  } catch {
    //
  }
}
