import type { AppUser } from "./users";
import { applyRecordScopeToQuery } from "./record-scope";
import type { ChatRecord } from "./records";
import { throwIfRetryableSupabaseError, withSupabaseFailover } from "./supabase";

export type WorkspaceVersionMeta = {
  count: number;
  maxId: number;
  maxUpdatedAtMs: number;
};

function maxUpdatedAtMsFromRecord(r: {
  updatedAt?: string | null;
  noteUpdatedAt?: string | null;
  leadNoteUpdatedAt?: string | null;
}): number {
  let max = 0;
  for (const raw of [r.updatedAt, r.noteUpdatedAt, r.leadNoteUpdatedAt]) {
    if (!raw) continue;
    const n = Date.parse(raw);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/** Derive version meta from an in-memory record slice (after full/partial load). */
export function versionMetaFromRecords(records: ChatRecord[]): WorkspaceVersionMeta {
  let maxId = 0;
  let maxUpdatedAtMs = 0;
  for (const r of records) {
    if (r.id > maxId) maxId = r.id;
    const t = maxUpdatedAtMsFromRecord(r);
    if (t > maxUpdatedAtMs) maxUpdatedAtMs = t;
  }
  return { count: records.length, maxId, maxUpdatedAtMs };
}

/** Fast scoped aggregates — one round-trip per query, no row pagination. */
export async function readWorkspaceVersionMeta(
  viewer: Partial<AppUser>,
): Promise<WorkspaceVersionMeta> {
  return withSupabaseFailover(async (sb) => {
    let countQuery = sb
      .from("chat_records")
      .select("*", { count: "exact", head: true });
    countQuery = applyRecordScopeToQuery(countQuery as never, viewer) as typeof countQuery;

    let latestQuery = sb
      .from("chat_records")
      .select("id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);
    latestQuery = applyRecordScopeToQuery(latestQuery as never, viewer) as typeof latestQuery;

    let maxIdQuery = sb
      .from("chat_records")
      .select("id")
      .order("id", { ascending: false })
      .limit(1);
    maxIdQuery = applyRecordScopeToQuery(maxIdQuery as never, viewer) as typeof maxIdQuery;

    const [countRes, latestRes, maxIdRes] = await Promise.all([
      countQuery,
      latestQuery,
      maxIdQuery,
    ]);

    throwIfRetryableSupabaseError(countRes.error, countRes.status, "workspace version count");
    throwIfRetryableSupabaseError(latestRes.error, latestRes.status, "workspace version latest");
    throwIfRetryableSupabaseError(maxIdRes.error, maxIdRes.status, "workspace version maxId");

    if (countRes.error) {
      throw new Error(`workspace version count: ${countRes.error.message}`);
    }

    const count = countRes.count ?? 0;
    const latestRow = latestRes.data?.[0] as { id?: number; updated_at?: string } | undefined;
    const maxIdRow = maxIdRes.data?.[0] as { id?: number } | undefined;
    const maxId = Number(maxIdRow?.id ?? latestRow?.id ?? 0);
    const maxUpdatedAtMs = latestRow?.updated_at
      ? Date.parse(String(latestRow.updated_at))
      : 0;

    return {
      count,
      maxId: Number.isFinite(maxId) ? maxId : 0,
      maxUpdatedAtMs: Number.isFinite(maxUpdatedAtMs) ? maxUpdatedAtMs : 0,
    };
  });
}
