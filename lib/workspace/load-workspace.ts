import type { SessionUser } from "@/lib/auth/constants";
import { notifUserKey } from "@/lib/auth/scoping";
import {
  filterTeamsListForViewer,
  filterUsersDirectoryForViewer,
} from "@/lib/auth/scoping-users";
import { readTeams, readProfiles } from "@/lib/db/catalogs";
import { readDismissedNotifsForUser } from "@/lib/db/dismissed-notifs";
import {
  readRecordsForViewer,
  type ChatRecord,
} from "@/lib/db/records";
import { readWorkspaceVersionMeta } from "@/lib/db/workspace-version";
import { readUsers } from "@/lib/db/users";
import { makeDisplayName } from "@/lib/utils/display-name";
import type { RecordLike } from "@/lib/auth/scoping";
import type { WorkspacePayload, WorkspaceUser, WorkspaceVersionPayload } from "./cache";
import { buildWorkspaceVersion } from "./build-version";
import { WORKSPACE_BOOTSTRAP_RECORD_LIMIT } from "./constants";
import {
  readServerCache,
  workspaceCacheKey,
  writeServerCache,
} from "./server-cache";

export type { WorkspacePayload, WorkspaceUser, WorkspaceVersionPayload } from "./cache";
export { hydrateSessionUser } from "@/lib/shell/load-shell-data";

type RecordScope = ChatRecord[] | RecordLike[];

const CATALOG_CACHE_KEY = "ws:shared:catalogs";
const CATALOG_TTL_MS = 30_000;

type SharedCatalogs = {
  allUsers: Awaited<ReturnType<typeof readUsers>>;
  teamsRoster: string[];
  profiles: string[];
};

async function loadSharedCatalogs(): Promise<SharedCatalogs> {
  const cached = readServerCache<SharedCatalogs>(CATALOG_CACHE_KEY);
  if (cached) return cached;

  const [allUsers, teamsRoster, profiles] = await Promise.all([
    readUsers(),
    readTeams(),
    readProfiles(),
  ]);
  const payload = { allUsers, teamsRoster, profiles };
  writeServerCache(CATALOG_CACHE_KEY, payload, CATALOG_TTL_MS);
  return payload;
}

function buildUsers(
  viewer: SessionUser,
  allUsers: Awaited<ReturnType<typeof readUsers>>,
  scopedRecords: RecordScope,
): WorkspaceUser[] {
  const usersRaw = filterUsersDirectoryForViewer(viewer, allUsers, scopedRecords);
  return usersRaw.map((u) => ({
    ...u,
    name: makeDisplayName(u),
  }));
}

type LoadWorkspaceOptions = { fresh?: boolean };

export async function loadWorkspaceVersion(
  viewer: SessionUser,
  options?: LoadWorkspaceOptions,
): Promise<WorkspaceVersionPayload> {
  const cacheKey = workspaceCacheKey(viewer.id, "version");
  if (!options?.fresh) {
    const cached = readServerCache<WorkspaceVersionPayload>(cacheKey);
    if (cached) return cached;
  }

  const vk = notifUserKey(viewer);
  const [meta, catalogs, dismissedIds] = await Promise.all([
    readWorkspaceVersionMeta(viewer),
    loadSharedCatalogs(),
    readDismissedNotifsForUser(vk),
  ]);

  const users = buildUsers(viewer, catalogs.allUsers, []);
  const teams = filterTeamsListForViewer(viewer, catalogs.teamsRoster, []);
  const version = buildWorkspaceVersion(
    meta,
    users.length,
    teams.length,
    catalogs.profiles.length,
    dismissedIds,
  );

  const payload: WorkspaceVersionPayload = {
    version,
    fetchedAt: Date.now(),
    dismissedNotifs: { [vk]: dismissedIds },
    notifUserKey: vk,
  };

  writeServerCache(cacheKey, payload, 1_500);
  return payload;
}

export async function loadWorkspaceData(
  viewer: SessionUser,
  options?: LoadWorkspaceOptions,
): Promise<WorkspacePayload> {
  const cacheKey = workspaceCacheKey(viewer.id, "full");
  if (!options?.fresh) {
    const cached = readServerCache<WorkspacePayload>(cacheKey);
    if (cached) return cached;
  }

  const vk = notifUserKey(viewer);
  const [records, catalogs, dismissedIds, meta] = await Promise.all([
    readRecordsForViewer(viewer),
    loadSharedCatalogs(),
    readDismissedNotifsForUser(vk),
    readWorkspaceVersionMeta(viewer),
  ]);

  const users = buildUsers(viewer, catalogs.allUsers, records);
  const teams = filterTeamsListForViewer(viewer, catalogs.teamsRoster, records);
  const version = buildWorkspaceVersion(
    meta,
    users.length,
    teams.length,
    catalogs.profiles.length,
    dismissedIds,
  );

  const payload: WorkspacePayload = {
    version,
    fetchedAt: Date.now(),
    records,
    users,
    teams,
    profiles: catalogs.profiles,
    dismissedNotifs: { [vk]: dismissedIds },
    notifUserKey: vk,
    recordsComplete: true,
  };

  if (!options?.fresh) {
    writeServerCache(cacheKey, payload, 2_000);
  }
  return payload;
}

/** Fast bootstrap — catalogs + latest N records for immediate UI. */
export async function loadWorkspaceBootstrap(
  viewer: SessionUser,
  limit = WORKSPACE_BOOTSTRAP_RECORD_LIMIT,
  options?: LoadWorkspaceOptions,
): Promise<WorkspacePayload> {
  const safeLimit = Math.min(500, Math.max(1, Math.floor(limit)));
  const cacheKey = workspaceCacheKey(viewer.id, `bootstrap:${safeLimit}`);
  if (!options?.fresh) {
    const cached = readServerCache<WorkspacePayload>(cacheKey);
    if (cached) return cached;
  }

  const vk = notifUserKey(viewer);
  const [records, catalogs, dismissedIds, meta] = await Promise.all([
    readRecordsForViewer(viewer, { limit: safeLimit }),
    loadSharedCatalogs(),
    readDismissedNotifsForUser(vk),
    readWorkspaceVersionMeta(viewer),
  ]);

  const users = buildUsers(viewer, catalogs.allUsers, records);
  const teams = filterTeamsListForViewer(viewer, catalogs.teamsRoster, records);
  const version = buildWorkspaceVersion(
    meta,
    users.length,
    teams.length,
    catalogs.profiles.length,
    dismissedIds,
  );

  const payload: WorkspacePayload = {
    version,
    fetchedAt: Date.now(),
    records,
    users,
    teams,
    profiles: catalogs.profiles,
    dismissedNotifs: { [vk]: dismissedIds },
    notifUserKey: vk,
    recordsComplete: false,
  };

  if (!options?.fresh) {
    writeServerCache(cacheKey, payload, 2_000);
  }
  return payload;
}
