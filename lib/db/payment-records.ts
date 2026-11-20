import type { AppUser } from "@/lib/db/users";
import { checkSupabaseResult, withSupabaseFailover } from "@/lib/db/supabase";
import { getUserTeamsList, isUnrestrictedTeamLead } from "@/lib/auth/scoping";
import { paymentVisibleToViewer } from "@/lib/payment-records/access";
import type { PaymentRecord, PaymentRecordInput } from "@/lib/payment-records/types";

const TABLE = "payment_records";
const PAGE = 1000;
const MAX_ROWS = 20000;

export function dbPaymentRowToApp(row: Record<string, unknown> | null): PaymentRecord | null {
  if (!row) return null;
  const id = Number(row.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    createdByUserId: String(row.created_by_user_id ?? ""),
    createdByRole: String(row.created_by_role ?? ""),
    fromDate: String(row.from_date ?? "").slice(0, 10),
    toDate: String(row.to_date ?? "").slice(0, 10),
    totalAmount: Number(row.total_amount ?? 0),
    initialAmount: Number(row.initial_amount ?? 0),
    finalAmount: Number(row.final_amount ?? 0),
    team: String(row.team ?? ""),
    profile: String(row.profile ?? ""),
    analyst: String(row.analyst ?? ""),
    clientName: String(row.client_name ?? ""),
    clientNumber: String(row.client_number ?? ""),
  };
}

function inputToDb(input: PaymentRecordInput): Record<string, unknown> {
  return {
    from_date: input.fromDate,
    to_date: input.toDate,
    total_amount: input.totalAmount,
    initial_amount: input.initialAmount,
    final_amount: input.finalAmount,
    // Column is NOT NULL with a 1..1000 check; the form no longer asks for a count.
    payment_count: 1,
    team: input.team,
    profile: input.profile,
    analyst: input.analyst,
    client_name: input.clientName,
    client_number: input.clientNumber,
  };
}

/** Records the viewer may see, newest period first. Scope is applied in SQL and re-checked in memory. */
export async function listPaymentRecordsForViewer(viewer: Partial<AppUser>): Promise<PaymentRecord[]> {
  const role = viewer?.role;
  if (role !== "analyst" && role !== "mainTeamLead" && role !== "teamLead") return [];
  const viewerId = String(viewer.id ?? "").trim();
  if (role === "analyst" && !viewerId) return [];
  const teams = getUserTeamsList(viewer);
  const teamScoped = role === "teamLead" && !isUnrestrictedTeamLead(viewer);
  if (teamScoped && !teams.length) return [];

  const out: PaymentRecord[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const rows = await withSupabaseFailover(async (sb) => {
      let q = sb.from(TABLE).select("*");
      if (role === "analyst") q = q.eq("created_by_user_id", viewerId);
      else if (role === "teamLead") {
        q = q.eq("created_by_role", "analyst");
        if (teamScoped) q = q.in("team", teams);
      }
      const res = await q
        .order("from_date", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE - 1);
      return checkSupabaseResult(res, "list payment_records") as Record<string, unknown>[];
    });
    for (const row of rows ?? []) {
      const rec = dbPaymentRowToApp(row);
      if (rec && paymentVisibleToViewer(viewer, rec)) out.push(rec);
    }
    if (!rows || rows.length < PAGE) break;
  }
  return out;
}

export async function readPaymentRecordById(id: number): Promise<PaymentRecord | null> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb.from(TABLE).select("*").eq("id", id).maybeSingle();
    const row = checkSupabaseResult(res, "read payment_record");
    return dbPaymentRowToApp(row as Record<string, unknown> | null);
  });
}

export async function insertPaymentRecord(
  viewer: Partial<AppUser>,
  input: PaymentRecordInput,
): Promise<PaymentRecord> {
  const now = new Date().toISOString();
  const payload = {
    ...inputToDb(input),
    created_by_user_id: String(viewer.id ?? ""),
    created_by_role: String(viewer.role ?? ""),
    created_at: now,
    updated_at: now,
  };
  return withSupabaseFailover(async (sb) => {
    const res = await sb.from(TABLE).insert(payload).select("*").single();
    const row = checkSupabaseResult(res, "insert payment_record");
    const rec = dbPaymentRowToApp(row as Record<string, unknown>);
    if (!rec) throw new Error("insert payment_record: invalid row");
    return rec;
  });
}

export async function updatePaymentRecord(
  id: number,
  input: PaymentRecordInput,
  updatedBy: string,
): Promise<PaymentRecord | null> {
  const payload = { ...inputToDb(input), updated_by: updatedBy, updated_at: new Date().toISOString() };
  return withSupabaseFailover(async (sb) => {
    const res = await sb.from(TABLE).update(payload).eq("id", id).select("*").maybeSingle();
    const row = checkSupabaseResult(res, "update payment_record");
    return dbPaymentRowToApp(row as Record<string, unknown> | null);
  });
}

export async function deletePaymentRecord(id: number): Promise<void> {
  await withSupabaseFailover(async (sb) => {
    const res = await sb.from(TABLE).delete().eq("id", id);
    checkSupabaseResult(res, "delete payment_record");
    return null;
  });
}
