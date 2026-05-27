import { create } from "zustand";
import type { ChatRecord } from "@/lib/db/records";
import {
  buildNotifications,
  NOTIFICATIONS_POPOVER_LIMIT,
  type NotificationItem,
} from "@/lib/notifications/build-notifications";
import type { WorkspacePayload, WorkspaceUser, WorkspaceVersionPayload } from "@/lib/workspace/cache";
import {
  readWorkspaceCache,
  writeWorkspaceCache,
  workspaceCacheKey,
} from "@/lib/workspace/cache";
import type { SessionUser } from "@/lib/auth/constants";
import { notifUserKey } from "@/lib/auth/scoping";

export type SyncSource = "idle" | "cache" | "network" | "syncing";

type WorkspaceState = {
  version: string;
  fetchedAt: number;
  records: ChatRecord[];
  users: WorkspaceUser[];
  teams: string[];
  profiles: string[];
  dismissedNotifs: Record<string, string[]>;
  notifUserKey: string;
  ready: boolean;
  recordsComplete: boolean;
  syncSource: SyncSource;
  cacheKey: string | null;
  /** Bumped on local record CRUD — blocks stale network snapshots from rolling back UI. */
  localRevision: number;

  bootstrapFromCache: (user: SessionUser) => boolean;
  applyPayload: (
    payload: WorkspacePayload,
    source: SyncSource,
    options?: { force?: boolean },
  ) => void;
  mergeVersionPayload: (payload: WorkspaceVersionPayload, source: SyncSource) => void;
  patchRecord: (record: ChatRecord) => void;
  removeRecord: (recordId: number) => void;
  touchNetwork: (version: string) => void;
  reset: () => void;
  dismissNotification: (notifId: string) => Promise<void>;
  dismissAllNotifications: (role: string) => Promise<void>;
};

async function persistDismissed(map: Record<string, string[]>): Promise<void> {
  const res = await fetch("/api/dismissed-notifs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ value: map }),
  });
  if (!res.ok) throw new Error("Could not save dismissals.");
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  version: "",
  fetchedAt: 0,
  records: [],
  users: [],
  teams: [],
  profiles: [],
  dismissedNotifs: {},
  notifUserKey: "",
  ready: false,
  recordsComplete: false,
  syncSource: "idle",
  cacheKey: null,
  localRevision: 0,

  bootstrapFromCache: (user) => {
    const key = workspaceCacheKey(user);
    const vk = notifUserKey(user);
    const cached = readWorkspaceCache(key);
    if (!cached) {
      set({ cacheKey: key, notifUserKey: vk });
      return false;
    }
    set({
      cacheKey: key,
      version: cached.version,
      fetchedAt: cached.fetchedAt,
      records: cached.records,
      users: cached.users,
      teams: cached.teams,
      profiles: cached.profiles,
      dismissedNotifs: cached.dismissedNotifs,
      notifUserKey: cached.notifUserKey,
      ready: true,
      recordsComplete: cached.recordsComplete !== false,
      syncSource: "cache",
    });
    return true;
  },

  applyPayload: (payload, source, options) => {
    const state = get();
    const { cacheKey, localRevision, version } = state;
    const complete = payload.recordsComplete !== false;
    const force = options?.force === true;

    const staleNetworkSnapshot =
      !force &&
      source === "network" &&
      localRevision > 0 &&
      Boolean(version) &&
      payload.version === version;

    if (staleNetworkSnapshot) {
      set({
        dismissedNotifs: payload.dismissedNotifs,
        notifUserKey: payload.notifUserKey,
        fetchedAt: payload.fetchedAt,
        syncSource: source,
      });
      if (cacheKey) {
        writeWorkspaceCache(cacheKey, {
          version: state.version,
          fetchedAt: payload.fetchedAt,
          records: state.records,
          users: state.users,
          teams: state.teams,
          profiles: state.profiles,
          dismissedNotifs: payload.dismissedNotifs,
          notifUserKey: payload.notifUserKey,
          recordsComplete: state.recordsComplete,
        });
      }
      return;
    }

    set({
      version: payload.version,
      fetchedAt: payload.fetchedAt,
      records: payload.records,
      users: payload.users,
      teams: payload.teams,
      profiles: payload.profiles,
      dismissedNotifs: payload.dismissedNotifs,
      notifUserKey: payload.notifUserKey,
      ready: true,
      recordsComplete: complete,
      syncSource: source,
      localRevision: source === "network" ? 0 : state.localRevision,
    });
    if (cacheKey) writeWorkspaceCache(cacheKey, { ...payload, recordsComplete: complete });
  },

  mergeVersionPayload: (payload, source) => {
    const { cacheKey, records, users, teams, profiles, recordsComplete } = get();
    set({
      version: payload.version,
      fetchedAt: payload.fetchedAt,
      dismissedNotifs: payload.dismissedNotifs,
      notifUserKey: payload.notifUserKey,
      ready: true,
      recordsComplete,
      syncSource: source,
    });
    if (cacheKey) {
      writeWorkspaceCache(cacheKey, {
        version: payload.version,
        fetchedAt: payload.fetchedAt,
        records,
        users,
        teams,
        profiles,
        dismissedNotifs: payload.dismissedNotifs,
        notifUserKey: payload.notifUserKey,
        recordsComplete,
      });
    }
  },

  patchRecord: (record) => {
    const state = get();
    const localRevision = state.localRevision + 1;
    const exists = state.records.some((r) => r.id === record.id);
    const records = exists
      ? state.records.map((r) => (r.id === record.id ? record : r))
      : [record, ...state.records].sort(
          (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
        );
    set({ records, localRevision });
    if (state.cacheKey) {
      writeWorkspaceCache(state.cacheKey, {
        version: state.version,
        fetchedAt: Date.now(),
        records,
        users: state.users,
        teams: state.teams,
        profiles: state.profiles,
        dismissedNotifs: state.dismissedNotifs,
        notifUserKey: state.notifUserKey,
        recordsComplete: state.recordsComplete,
      });
    }
  },

  removeRecord: (recordId) => {
    const state = get();
    const localRevision = state.localRevision + 1;
    const records = state.records.filter((r) => r.id !== recordId);
    set({ records, localRevision });
    if (state.cacheKey) {
      writeWorkspaceCache(state.cacheKey, {
        version: state.version,
        fetchedAt: Date.now(),
        records,
        users: state.users,
        teams: state.teams,
        profiles: state.profiles,
        dismissedNotifs: state.dismissedNotifs,
        notifUserKey: state.notifUserKey,
        recordsComplete: state.recordsComplete,
      });
    }
  },

  touchNetwork: (version) => {
    set({ syncSource: "network", fetchedAt: Date.now(), version: version || get().version });
  },

  reset: () => {
    set({
      version: "",
      fetchedAt: 0,
      records: [],
      users: [],
      teams: [],
      profiles: [],
      dismissedNotifs: {},
      notifUserKey: "",
      ready: false,
      recordsComplete: false,
      syncSource: "idle",
      cacheKey: null,
      localRevision: 0,
    });
  },

  dismissNotification: async (notifId) => {
    const { dismissedNotifs, notifUserKey, cacheKey, version, fetchedAt, records, users, teams, profiles } = get();
    const existing = dismissedNotifs[notifUserKey] || [];
    if (existing.includes(notifId)) return;
    const prev = dismissedNotifs;
    const updated = {
      ...dismissedNotifs,
      [notifUserKey]: [...existing, notifId],
    };
    set({ dismissedNotifs: updated });
    if (cacheKey) {
      writeWorkspaceCache(cacheKey, {
        version,
        fetchedAt,
        records,
        users,
        teams,
        profiles,
        dismissedNotifs: updated,
        notifUserKey,
      });
    }
    try {
      await persistDismissed({ [notifUserKey]: updated[notifUserKey] });
    } catch {
      set({ dismissedNotifs: prev });
      throw new Error("Could not save dismissal.");
    }
  },

  dismissAllNotifications: async (role) => {
    const dismissed = get().dismissedNotifs[get().notifUserKey] || [];
    const items = buildNotifications(get().records, dismissed, role);
    const ids = items.map((n) => n.id);
    if (!ids.length) return;
    const { notifUserKey } = get();
    const existing = get().dismissedNotifs[notifUserKey] || [];
    const prev = get().dismissedNotifs;
    const updated = {
      ...prev,
      [notifUserKey]: [...new Set([...existing, ...ids])],
    };
    set({ dismissedNotifs: updated });
    const st = get();
    if (st.cacheKey) {
      writeWorkspaceCache(st.cacheKey, {
        version: st.version,
        fetchedAt: st.fetchedAt,
        records: st.records,
        users: st.users,
        teams: st.teams,
        profiles: st.profiles,
        dismissedNotifs: updated,
        notifUserKey: st.notifUserKey,
      });
    }
    try {
      await persistDismissed({ [notifUserKey]: updated[notifUserKey] });
    } catch {
      set({ dismissedNotifs: prev });
      throw new Error("Could not save dismissals.");
    }
  },
}));

export function selectUndismissedNotifications(
  state: WorkspaceState,
  role: string,
): NotificationItem[] {
  const dismissed = state.dismissedNotifs[state.notifUserKey] || [];
  return buildNotifications(state.records, dismissed, role);
}

export function selectNotificationCount(state: WorkspaceState, role: string): number {
  return selectUndismissedNotifications(state, role).length;
}

export function selectPopoverNotifications(
  state: WorkspaceState,
  role: string,
): NotificationItem[] {
  return selectUndismissedNotifications(state, role).slice(
    0,
    NOTIFICATIONS_POPOVER_LIMIT,
  );
}
