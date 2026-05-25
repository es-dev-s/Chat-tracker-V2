import type { AppUser } from "./users";
import { filterRecordsForViewer } from "@/lib/auth/scoping";
import { applyRecordScopeToQuery } from "./record-scope";
import {
  checkSupabaseResult,
  throwIfRetryableSupabaseError,
  withSupabaseFailover,
} from "./supabase";

export type ChatRecord = {
  id: number;
  date: string;
  analyst: string;
  team: string;
  profile: string;
  clientName: string;
  phone: string;
  note: string;
  firstReceive: string;
  firstReply: string;
  clientLastReply: string;
  analystLastReply: string;
  received: number;
  attempted: number;
  resolved: number;
  replyDiff: number | null;
  totalConv: number | null;
  noteUpdatedAt: string | null;
  noteUpdatedBy: string | null;
  leadNote: string;
  leadNoteUpdatedAt: string | null;
  leadNoteUpdatedBy: string | null;
  isLeadNoteOnly: boolean;
  createdBy: string;
  updatedAt?: string | null;
};

function dbChatRowToApp(row: Record<string, unknown>): ChatRecord | null {
  if (row == null || row.id == null) return null;
  return {
    id: Number(row.id),
    date: String(row.date ?? ""),
    analyst: String(row.analyst ?? ""),
    team: String(row.team ?? ""),
    profile: String(row.profile ?? ""),
    clientName: String(row.client_name ?? ""),
    phone: String(row.phone ?? ""),
    note: String(row.note ?? ""),
    firstReceive: String(row.first_receive ?? ""),
    firstReply: String(row.first_reply ?? ""),
    clientLastReply: String(row.client_last_reply ?? ""),
    analystLastReply: String(row.analyst_last_reply ?? ""),
    received: Number(row.received ?? 1),
    attempted: Number(row.attempted ?? 1),
    resolved: Number(row.resolved ?? 1),
    replyDiff: row.reply_diff != null ? Number(row.reply_diff) : null,
    totalConv: row.total_conv != null ? Number(row.total_conv) : null,
    noteUpdatedAt: row.note_updated_at != null ? String(row.note_updated_at) : null,
    noteUpdatedBy: row.note_updated_by != null ? String(row.note_updated_by) : null,
    leadNote: String(row.lead_note ?? ""),
    leadNoteUpdatedAt:
      row.lead_note_updated_at != null ? String(row.lead_note_updated_at) : null,
    leadNoteUpdatedBy:
      row.lead_note_updated_by != null ? String(row.lead_note_updated_by) : null,
    isLeadNoteOnly: Boolean(row.is_lead_note_only),
    createdBy: String(row.created_by ?? ""),
    updatedAt: row.updated_at != null ? String(row.updated_at) : null,
  };
}

const FINGERPRINT_COLUMNS =
  "id,date,analyst,team,received,attempted,resolved,reply_diff,total_conv,first_receive,first_reply,note_updated_at,lead_note_updated_at";

function dbFingerprintRow(row: Record<string, unknown>) {
  if (row == null || row.id == null) return null;
  return {
    id: Number(row.id),
    date: String(row.date ?? ""),
    analyst: String(row.analyst ?? ""),
    team: String(row.team ?? ""),
    received: Number(row.received ?? 1),
    attempted: Number(row.attempted ?? 1),
    resolved: Number(row.resolved ?? 1),
    replyDiff: row.reply_diff != null ? Number(row.reply_diff) : null,
    totalConv: row.total_conv != null ? Number(row.total_conv) : null,
    firstReceive: String(row.first_receive ?? ""),
    firstReply: String(row.first_reply ?? ""),
    noteUpdatedAt: row.note_updated_at != null ? String(row.note_updated_at) : null,
    leadNoteUpdatedAt:
      row.lead_note_updated_at != null ? String(row.lead_note_updated_at) : null,
  };
}

async function paginateScopedRows(
  viewer: Partial<AppUser>,
  columns: string,
  options?: { limit?: number },
): Promise<Record<string, unknown>[]> {
  return withSupabaseFailover(async (sb) => {
    if (options?.limit != null && options.limit > 0) {
      let query = sb
        .from("chat_records")
        .select(columns)
        .order("date", { ascending: false })
        .order("id", { ascending: false })
        .limit(options.limit);
      query = applyRecordScopeToQuery(query, viewer);
      const res = await query;
      throwIfRetryableSupabaseError(res.error, res.status, "read chat_records");
      if (res.error) {
        throw new Error(`read chat_records: ${res.error.message}`);
      }
      return Array.isArray(res.data) ? (res.data as unknown as Record<string, unknown>[]) : [];
    }

    const PAGE_SIZE = 1000;
    const rows: Record<string, unknown>[] = [];
    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;
      let query = sb
        .from("chat_records")
        .select(columns)
        .order("id", { ascending: true })
        .range(from, to);
      query = applyRecordScopeToQuery(query, viewer);
      const res = await query;
      throwIfRetryableSupabaseError(res.error, res.status, "read chat_records");
      if (res.error) {
        throw new Error(`read chat_records: ${res.error.message}`);
      }
      const chunk = Array.isArray(res.data) ? res.data : [];
      rows.push(...(chunk as unknown as Record<string, unknown>[]));
      if (chunk.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return rows;
  });
}

/** Role-scoped record load — DB filters first, in-memory guard second. */
export async function readRecordsForViewer(
  viewer: Partial<AppUser>,
  options?: { limit?: number },
): Promise<ChatRecord[]> {
  const rows = await paginateScopedRows(viewer, "*", options);
  const mapped = rows.map(dbChatRowToApp).filter((r): r is ChatRecord => r !== null);
  return filterRecordsForViewer(viewer, mapped) as ChatRecord[];
}

export async function readRecordFingerprintsForViewer(viewer: Partial<AppUser>) {
  const rows = await paginateScopedRows(viewer, FINGERPRINT_COLUMNS);
  const mapped = rows.map(dbFingerprintRow).filter((r) => r !== null);
  return filterRecordsForViewer(viewer, mapped);
}

/** Single scoped row by id — avoids full-table scans on PATCH/DELETE. */
export async function readRecordByIdForViewer(
  viewer: Partial<AppUser>,
  id: number,
): Promise<ChatRecord | null> {
  if (!Number.isFinite(id)) return null;
  return withSupabaseFailover(async (sb) => {
    let query = sb.from("chat_records").select("*").eq("id", id).maybeSingle();
    query = applyRecordScopeToQuery(query as never, viewer) as typeof query;
    const res = await query;
    throwIfRetryableSupabaseError(res.error, res.status, `read chat_record ${id}`);
    if (res.error) {
      throw new Error(`read chat_record ${id}: ${res.error.message}`);
    }
    if (!res.data) return null;
    const record = dbChatRowToApp(res.data as Record<string, unknown>);
    if (!record) return null;
    const scoped = filterRecordsForViewer(viewer, [record]);
    return scoped.length ? (scoped[0] as ChatRecord) : null;
  });
}

export async function readRecords(): Promise<ChatRecord[]> {
  return withSupabaseFailover(async (sb) => {
    const PAGE_SIZE = 1000;
    const rows: Record<string, unknown>[] = [];
    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;
      const res = await sb
        .from("chat_records")
        .select("*")
        .order("id", { ascending: true })
        .range(from, to);
      throwIfRetryableSupabaseError(res.error, res.status, "read chat_records");
      if (res.error) {
        throw new Error(`read chat_records: ${res.error.message}`);
      }
      const chunk = Array.isArray(res.data) ? res.data : [];
      rows.push(...(chunk as Record<string, unknown>[]));
      if (chunk.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    return rows.map(dbChatRowToApp).filter((r): r is ChatRecord => r !== null);
  });
}
