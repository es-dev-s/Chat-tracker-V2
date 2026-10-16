import type { ChatRecord } from "./records";
import { normalizeAmountToPay } from "@/lib/records/amount";
import { normalizeChatDirection } from "@/lib/records/chat-direction";
import { normalizeReplyTiming, type ReplyTiming } from "@/lib/records/reply-timing";
import { checkSupabaseResult, withSupabaseFailover } from "./supabase";

function normalizeFollowUpText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

/**
 * Only send chat_direction when a valid value is present, so writes to legacy
 * rows (no direction) keep working even before the chat_direction migration.
 */
function chatDirectionColumn(rec: Record<string, unknown>): { chat_direction?: string } {
  const direction = normalizeChatDirection(rec.chatDirection ?? rec.chat_direction);
  return direction ? { chat_direction: direction } : {};
}

function appRecordToDbRowForInsert(rec: Record<string, unknown>) {
  return {
    ...chatDirectionColumn(rec),
    date: rec.date ?? "",
    analyst: rec.analyst ?? "",
    team: rec.team ?? "",
    profile: rec.profile ?? "",
    client_name: rec.clientName ?? "",
    phone: rec.phone ?? "",
    note: rec.note ?? "",
    amount_to_pay: normalizeAmountToPay(rec.amountToPay ?? rec.amount_to_pay),
    required_documents: normalizeFollowUpText(
      rec.requiredDocuments ?? rec.required_documents,
      1000,
    ),
    class_session_date: normalizeFollowUpText(
      rec.classSessionDate ?? rec.class_session_date,
      10,
    ),
    class_session_time: normalizeFollowUpText(
      rec.classSessionTime ?? rec.class_session_time,
      5,
    ),
    class_session_instructions: normalizeFollowUpText(
      rec.classSessionInstructions ?? rec.class_session_instructions,
      1000,
    ),
    first_receive: rec.firstReceive ?? "",
    first_reply: rec.firstReply ?? "",
    client_last_reply: rec.clientLastReply ?? "",
    analyst_last_reply: rec.analystLastReply ?? "",
    first_chat_screenshot: String(rec.firstChatScreenshot ?? "").trim(),
    last_chat_screenshot: String(rec.lastChatScreenshot ?? "").trim(),
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
    amountToPay: String(row.amount_to_pay ?? ""),
    chatDirection: normalizeChatDirection(row.chat_direction),
    replyTiming: normalizeReplyTiming(row.reply_timing),
    requiredDocuments: String(row.required_documents ?? ""),
    classSessionDate: String(row.class_session_date ?? ""),
    classSessionTime: String(row.class_session_time ?? ""),
    classSessionInstructions: String(row.class_session_instructions ?? ""),
    firstReceive: String(row.first_receive ?? ""),
    firstReply: String(row.first_reply ?? ""),
    clientLastReply: String(row.client_last_reply ?? ""),
    analystLastReply: String(row.analyst_last_reply ?? ""),
    firstChatScreenshot: String(row.first_chat_screenshot ?? ""),
    lastChatScreenshot: String(row.last_chat_screenshot ?? ""),
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
    acknowledgedAt: row.acknowledged_at != null ? String(row.acknowledged_at) : null,
    acknowledgedBy: row.acknowledged_by != null ? String(row.acknowledged_by) : null,
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

/** Sets or clears acknowledgement on one row. Does not rewrite the rest of the chat. */
/** Sets or clears reply_timing on one row. Does not rewrite the rest of the chat. */
export async function setChatRecordReplyTiming(
  recordId: number,
  replyTiming: ReplyTiming | null,
): Promise<ChatRecord> {
  const now = new Date().toISOString();
  return withSupabaseFailover(async (sb) => {
    const res = await sb
      .from("chat_records")
      .update({
        reply_timing: replyTiming,
        updated_at: now,
      })
      .eq("id", recordId)
      .select("*")
      .maybeSingle();
    checkSupabaseResult(res, "set reply_timing");
    const mapped = dbChatRowToApp(res.data as Record<string, unknown>);
    if (!mapped) throw new Error("set reply_timing: invalid row");
    return mapped;
  });
}

export async function setChatRecordAcknowledged(
  recordId: number,
  acknowledged: boolean,
  acknowledgedBy: string | null,
): Promise<ChatRecord> {
  const now = new Date().toISOString();
  return withSupabaseFailover(async (sb) => {
    const res = await sb
      .from("chat_records")
      .update({
        acknowledged_at: acknowledged ? now : null,
        acknowledged_by: acknowledged ? acknowledgedBy : null,
        updated_at: now,
      })
      .eq("id", recordId)
      .select("*")
      .maybeSingle();
    checkSupabaseResult(res, "acknowledge chat_record");
    const mapped = dbChatRowToApp(res.data as Record<string, unknown>);
    if (!mapped) throw new Error("acknowledge chat_record: invalid row");
    return mapped;
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
