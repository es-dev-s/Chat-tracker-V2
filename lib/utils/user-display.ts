import type { WorkspaceUser } from "@/lib/workspace/cache";

export function normalizePeekKey(value: string): string {
  return String(value || "").trim().toLowerCase();
}

export function matchUserFromAnalystOrEmail(
  rawName: string,
  users: WorkspaceUser[],
): WorkspaceUser | null {
  const key = normalizePeekKey(rawName);
  if (!key || !Array.isArray(users)) return null;
  for (const u of users) {
    if (!u || typeof u !== "object") continue;
    const nameKey = normalizePeekKey(u.name || "");
    const emailKey = normalizePeekKey(u.email || "");
    if (nameKey && key === nameKey) return u;
    if (emailKey && key === emailKey) return u;
  }
  return null;
}

export function initialsForPeek(nameSource: string): string {
  const parts = String(nameSource || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) {
    const w = parts[0];
    return w.length <= 2
      ? w.toUpperCase()
      : `${w[0]}${w[Math.min(1, w.length - 1)]}`.toUpperCase().slice(0, 2);
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase().slice(0, 2);
}
