import { checkSupabaseResult, withSupabaseFailover } from "./supabase";

export async function readDismissedNotifsForUser(
  userKey: string,
): Promise<string[]> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb
      .from("dismissed_notifs")
      .select("notif_ids")
      .eq("user_key", userKey)
      .maybeSingle();
    checkSupabaseResult(res, "read dismissed_notifs");
    const ids = res.data?.notif_ids;
    return Array.isArray(ids) ? ids.map(String) : [];
  });
}

export async function readDismissedNotifs(): Promise<Record<string, string[]>> {
  return withSupabaseFailover(async (sb) => {
    const res = await sb.from("dismissed_notifs").select("user_key, notif_ids");
    checkSupabaseResult(res, "read dismissed_notifs");
    const dismissedNotifs: Record<string, string[]> = {};
    for (const row of res.data || []) {
      const ids = row.notif_ids;
      dismissedNotifs[row.user_key] = Array.isArray(ids) ? ids.map(String) : [];
    }
    return dismissedNotifs;
  });
}

export async function writeDismissedNotifs(map: Record<string, string[]>): Promise<void> {
  await withSupabaseFailover(async (sb) => {
    const res = await sb.rpc("merge_dismissed_notifs", { p_map: map });
    checkSupabaseResult(res, "merge_dismissed_notifs");
    return null;
  });
}
