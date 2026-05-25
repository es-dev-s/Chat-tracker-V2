import { dismissedNotifsHash } from "./version";
import type { WorkspaceVersionMeta } from "@/lib/db/workspace-version";

export function buildWorkspaceVersion(
  meta: WorkspaceVersionMeta,
  userCount: number,
  teamCount: number,
  profileCount: number,
  dismissedIds: string[] = [],
): string {
  const dismissed = dismissedNotifsHash(dismissedIds);
  return `${meta.count}:${meta.maxId}:${meta.maxUpdatedAtMs}:${userCount}:${teamCount}:${profileCount}:${dismissed}`;
}
