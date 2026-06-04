import type { ChatRecord } from "./records";
import { checkSupabaseResult, withSupabaseFailover } from "./supabase";

function appRecordToDbRowForInsert(rec: Record<string, unknown>) {
  return {
    date: rec.date ?? "",
    analyst: rec.analyst ?? "",
    team: rec.team ?? "",
    profile: rec.profile ?? "",
    client_name: rec.clientName ?? "",
    phone: rec.phone ?? "",
    note: rec.note ?? "",
    first_receive: rec.firstReceive ?? "",
    first_reply: rec.firstReply ?? "",
    client_last_reply: rec.clientLastReply ?? "",
    analyst_last_reply: rec.analystLastReply ?? "",
    received: Number(rec.received ?? 1),
    attempted: Number(rec.attempted ?? 1),
    resolved: Number(rec.resolved ?? 1),
    reply_diff: rec.replyDiff != null ? Number(rec.replyDiff) : null,
    total_conv: rec.totalConv != null ? Number(rec.totalConv) : null,
    note_updated_at: rec.noteUpdatedAt || null,
    note_updated_by: rec.noteUpdatedBy || null,
    lead_note: rec.leadNote ?? "",
    lead_note_updated_at: rec.leadNoteUpdatedAt || null,
    lead_note_updated_by: rec.leadNoteUpdatedBy || null,
    is_lead_note_only: Boolean(rec.isLeadNoteOnly),
    created_by: (rec.createdBy && String(rec.createdBy).trim()) || null,
    updated_at: new Date().toISOString(),
  };
}

function appRecordToDbRow(rec: Record<string, unknown>) {
  const id = Number(rec.id);
  if (!Number.isFinite(id)) throw new Error("Invalid record id");
  return { id, ...appRecordToDbRowForInsert(rec) };
}

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

export async function insertChatRecord(
  recSansId: Record<string, unknown>,
): Promise<ChatRecord> {
  return withSupabaseFailover(async (sb) => {
    const row = appRecordToDbRowForInsert(recSansId);
    const res = await sb.from("chat_records").insert(row).select("*").single();
    checkSupabaseResult(res, "insert chat_records");
    const mapped = dbChatRowToApp(res.data as Record<string, unknown>);
    if (!mapped) throw new Error("insert chat_records: invalid row");
    return mapped;
  });
}

export async function upsertChatRecord(rec: Record<string, unknown>): Promise<void> {
  await withSupabaseFailover(async (sb) => {
    const row = appRecordToDbRow(rec);
    const res = await sb.from("chat_records").upsert(row, { onConflict: "id" });
    checkSupabaseResult(res, "upsert chat_records");
    return null;
  });
}

export async function deleteChatRecordById(recordId: number | string): Promise<void> {
  await withSupabaseFailover(async (sb) => {
    const n = Number(recordId);
    if (!Number.isFinite(n)) throw new Error("Invalid record id");
    const res = await sb.rpc("delete_chat_record", { p_id: Math.trunc(n) });
    checkSupabaseResult(res, "delete_chat_record");
    return null;
  });
}
