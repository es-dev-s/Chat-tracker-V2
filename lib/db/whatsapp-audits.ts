import type { AppUser } from "@/lib/db/users";
import { normEmail } from "@/lib/db/users";
import { checkSupabaseResult, withSupabaseFailover } from "@/lib/db/supabase";
import { getUserTeamsList, isUnrestrictedTeamLead } from "@/lib/auth/scoping";
import { normalizeReplyTiming, type ReplyTiming } from "@/lib/records/reply-timing";
import { auditVisibleToViewer } from "@/lib/whatsapp-audit/access";
import type { WhatsAppAudit, WhatsAppAuditInput } from "@/lib/whatsapp-audit/types";

const TABLE = "whatsapp_audits";
const PAGE = 1000;
const MAX_ROWS = 20000;

export function dbAuditRowToApp(row: Record<string, unknown> | null): WhatsAppAudit | null {
  if (!row) return null;
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    createdByUserId: String(row.created_by_user_id ?? ""),
    analyst: String(row.analyst ?? ""),
    analystEmail: String(row.analyst_email ?? ""),
    date: String(row.audit_date ?? "").slice(0, 10),
    shift: String(row.shift ?? ""),
    team: String(row.team ?? ""),
    profile: String(row.profile ?? ""),
    clientName: String(row.client_name ?? ""),
    clientMsgReceived: String(row.client_msg_received ?? ""),
    replyTime: String(row.reply_time ?? ""),
    category: normalizeReplyTiming(row.category),
    clientMessage: String(row.client_message ?? ""),
    clientMsgDate: row.client_msg_date ? String(row.client_msg_date).slice(0, 10) : "",
    replyDate: row.reply_date ? String(row.reply_date).slice(0, 10) : "",
  };
}

/**
 * The date columns come from a later migration. Until it is run (e.g. on cloud),
 * writes retry without them so saving never breaks; dates are just not stored.
 */
const DATE_COLUMNS = ["client_msg_date", "reply_date"] as const;
let dateColumnsMissingUntil = 0;

function isMissingDateColumnError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return DATE_COLUMNS.some((c) => msg.includes(c)) && /column|schema cache/i.test(msg);
}

async function withDateColumnFallback<T>(
  payload: Record<string, unknown>,
  run: (payload: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  const stripped = { ...payload };
  for (const c of DATE_COLUMNS) delete stripped[c];
  if (Date.now() < dateColumnsMissingUntil) return run(stripped);
  try {
    return await run(payload);
  } catch (err) {
    if (!isMissingDateColumnError(err)) throw err;
    dateColumnsMissingUntil = Date.now() + 60_000;
    console.warn("whatsapp_audits: date columns missing; run supabase/cloud-scripts/whatsapp_audit_reply_dates.sql");
    return run(stripped);
  }
}

function inputToDb(input: WhatsAppAuditInput): Record<string, unknown> {
  return {
    audit_date: input.date,
    shift: input.shift,
    team: input.team,
    profile: input.profile,
    client_name: input.clientName,
    client_msg_received: input.clientMsgReceived,
    reply_time: input.replyTime,
    category: input.category,
    client_message: input.clientMessage,
    client_msg_date: input.clientMsgDate || null,
    reply_date: (input.replyTime && input.replyDate) || null,
  };
}

/** Entries the viewer may see, newest first. Scope is applied in SQL and re-checked in memory. */
export async function listWhatsAppAuditsForViewer(viewer: Partial<AppUser>): Promise<WhatsAppAudit[]> {
  const role = viewer?.role;
  if (!role) return [];
  const teams = getUserTeamsList(viewer);
  const viewerId = String(viewer.id ?? "").trim();
  if (role === "analyst" && !viewerId) return [];
  if ((role === "mainTeamLead" || (role === "teamLead" && !isUnrestrictedTeamLead(viewer))) && !teams.length) {
    return [];
  }
  if (role !== "analyst" && role !== "mainTeamLead" && role !== "teamLead") return [];

  const out: WhatsAppAudit[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const rows = await withSupabaseFailover(async (sb) => {
      let q = sb.from(TABLE).select("*");
      if (role === "analyst") q = q.eq("created_by_user_id", viewerId);
      else if (!isUnrestrictedTeamLead(viewer)) q = q.in("team", teams);
      const res = await q
        .order("audit_date", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE - 1);
      return checkSupabaseResult(res, "list whatsapp_audits") as Record<string, unknown>[];
    });
    for (const row of rows ?? []) {
      const audit = dbAuditRowToApp(row);
      if (audit && auditVisibleToViewer(viewer, audit)) out.push(audit);
    }
    if (!rows || rows.length < PAGE) break;
  }
  return out;
}

export async function readWhatsAppAuditById(id: number): Promise<WhatsAppAudit | null> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb.from(TABLE).select("*").eq("id", id).maybeSingle();
    const row = checkSupabaseResult(res, "read whatsapp_audit");
    return dbAuditRowToApp(row as Record<string, unknown> | null);
  });
}

export async function insertWhatsAppAudit(
  viewer: Partial<AppUser>,
  analystName: string,
  input: WhatsAppAuditInput,
): Promise<WhatsAppAudit> {
  const now = new Date().toISOString();
  const payload = {
    ...inputToDb(input),
    created_by_user_id: String(viewer.id ?? ""),
    analyst: analystName,
    analyst_email: normEmail(viewer.email),
    created_at: now,
    updated_at: now,
  };
  return withDateColumnFallback(payload, (p) => withSupabaseFailover(async (sb) => {
    const res = await sb
      .from(TABLE)
      .insert(p)
      .select("*")
      .single();
    const row = checkSupabaseResult(res, "insert whatsapp_audit");
    const audit = dbAuditRowToApp(row as Record<string, unknown>);
    if (!audit) throw new Error("insert whatsapp_audit: invalid row");
    return audit;
  }));
}

export async function updateWhatsAppAudit(
  id: number,
  input: WhatsAppAuditInput,
  updatedBy: string,
): Promise<WhatsAppAudit | null> {
  const payload = { ...inputToDb(input), updated_by: updatedBy, updated_at: new Date().toISOString() };
  return withDateColumnFallback(payload, (p) => withSupabaseFailover(async (sb) => {
    const res = await sb
      .from(TABLE)
      .update(p)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    const row = checkSupabaseResult(res, "update whatsapp_audit");
    return dbAuditRowToApp(row as Record<string, unknown> | null);
  }));
}

export async function setWhatsAppAuditCategory(
  id: number,
  category: ReplyTiming | null,
  updatedBy: string,
): Promise<WhatsAppAudit | null> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb
      .from(TABLE)
      .update({ category, updated_by: updatedBy, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    const row = checkSupabaseResult(res, "set whatsapp_audit category");
    return dbAuditRowToApp(row as Record<string, unknown> | null);
  });
}

export async function deleteWhatsAppAudit(id: number): Promise<void> {
  await withSupabaseFailover(async (sb) => {
    const res = await sb.from(TABLE).delete().eq("id", id);
    checkSupabaseResult(res, "delete whatsapp_audit");
    return null;
  });
}
