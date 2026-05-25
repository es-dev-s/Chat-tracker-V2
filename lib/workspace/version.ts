import type { ChatRecord } from "@/lib/db/records";

export type RecordFingerprint = {
  id: number;
  date: string;
  analyst: string;
  team: string;
  received: number;
  attempted: number;
  resolved: number;
  replyDiff: number | null;
  totalConv: number | null;
  firstReceive: string;
  firstReply: string;
  noteUpdatedAt: string | null;
  leadNoteUpdatedAt: string | null;
};

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function fingerprintChecksum(rows: RecordFingerprint[]): number {
  let h = 0;
  for (const r of rows) {
    h = (h * 31 + r.id) | 0;
    h = (h * 31 + r.received) | 0;
    h = (h * 31 + r.attempted) | 0;
    h = (h * 31 + r.resolved) | 0;
    h = (h * 31 + (r.replyDiff ?? 0)) | 0;
    h = (h * 31 + (r.totalConv ?? 0)) | 0;
    h = (h * 31 + hashString(r.firstReceive)) | 0;
    h = (h * 31 + hashString(r.firstReply)) | 0;
    h = (h * 31 + hashString(r.date)) | 0;
    h = (h * 31 + hashString(r.analyst)) | 0;
    h = (h * 31 + hashString(r.team)) | 0;
  }
  return h >>> 0;
}

function latestNoteTimestamp(rows: RecordFingerprint[]): number {
  let latestTs = 0;
  for (const r of rows) {
    for (const ts of [r.noteUpdatedAt, r.leadNoteUpdatedAt]) {
      if (!ts) continue;
      const n = Date.parse(ts);
      if (Number.isFinite(n) && n > latestTs) latestTs = n;
    }
  }
  return latestTs;
}

export function dismissedNotifsHash(ids: string[] | undefined): string {
  if (!ids?.length) return "0";
  let h = 0;
  for (const id of ids) {
    h = (h * 31 + hashString(id)) | 0;
  }
  return String(h >>> 0);
}

export function computeWorkspaceVersion(
  records: ChatRecord[] | RecordFingerprint[],
  userCount: number,
  teamCount: number,
  profileCount: number,
  dismissedIds: string[] = [],
): string {
  let maxId = 0;
  for (const r of records) {
    if (r.id > maxId) maxId = r.id;
  }
  const checksum = fingerprintChecksum(records);
  const latestTs = latestNoteTimestamp(records);
  const dismissed = dismissedNotifsHash(dismissedIds);
  return `${records.length}:${maxId}:${checksum}:${latestTs}:${userCount}:${teamCount}:${profileCount}:${dismissed}`;
}
