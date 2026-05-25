import type { SessionUser } from "@/lib/auth/constants";
import { filterRecordsForViewer, notifUserKey } from "@/lib/auth/scoping";
import { readDismissedNotifs } from "@/lib/db/dismissed-notifs";
import { readRecords, type ChatRecord } from "@/lib/db/records";
import { makeDisplayName } from "@/lib/utils/display-name";

export type ShellData = {
  records: ChatRecord[];
  dismissedNotifs: Record<string, string[]>;
  notifUserKey: string;
};

export async function loadShellData(viewer: SessionUser): Promise<ShellData> {
  const [allRecords, dismissedMap] = await Promise.all([
    readRecords(),
    readDismissedNotifs(),
  ]);

  const records = filterRecordsForViewer(viewer, allRecords) as ChatRecord[];
  const vk = notifUserKey(viewer);

  return {
    records,
    dismissedNotifs: { [vk]: dismissedMap[vk] || [] },
    notifUserKey: vk,
  };
}

export function hydrateSessionUser(viewer: SessionUser): SessionUser {
  return { ...viewer, name: makeDisplayName(viewer) };
}
