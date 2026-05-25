import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseFailoverPool, runSupabase, throwIfRetryableSupabaseError } from "./supabase-failover";

export { runSupabase, throwIfRetryableSupabaseError } from "./supabase-failover";
export type { SupabaseFailoverPool } from "./supabase-failover";

/** Active Supabase client (primary or secondary after failover). */
export function getSupabaseClient(): SupabaseClient {
  return getSupabaseFailoverPool().getActiveClient();
}

/** Preferred for all DB reads/writes — retries on the standby node when the active DB fails. */
export async function withSupabaseFailover<T>(
  operation: (client: SupabaseClient) => Promise<T>,
): Promise<T> {
  return runSupabase(operation);
}

export function getSupabaseFailoverStatus() {
  return getSupabaseFailoverPool().status();
}

export function checkSupabaseResult<T>(
  res: { data: T; error: PostgrestError | null; status?: number },
  context: string,
): T {
  throwIfRetryableSupabaseError(res.error, res.status, context);
  if (res.error) throw new Error(`${context}: ${res.error.message}`);
  return res.data;
}
