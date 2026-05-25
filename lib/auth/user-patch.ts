import type { AppUser } from "@/lib/db/users";

export function mergeUserFieldsForPatch(
  existing: Partial<AppUser>,
  patch: Record<string, unknown>,
): AppUser {
  const e = existing && typeof existing === "object" ? existing : {};
  const p = patch && typeof patch === "object" ? { ...patch } : {};
  delete p.role;
  delete p.isAdmin;
  delete p.is_admin;
  return {
    id: e.id as AppUser["id"],
    name: "name" in p ? String(p.name ?? "") : String(e.name ?? ""),
    role: String(e.role ?? "") as AppUser["role"],
    email: "email" in p ? String(p.email ?? "") : String(e.email ?? ""),
    password: "password" in p ? String(p.password ?? "") : String(e.password ?? ""),
    teamName: "teamName" in p ? String(p.teamName ?? "") : String(e.teamName ?? ""),
    teamNames:
      "teamNames" in p && Array.isArray(p.teamNames)
        ? p.teamNames.map(String)
        : Array.isArray(e.teamNames)
          ? e.teamNames
          : [],
    profileNames:
      "profileNames" in p && Array.isArray(p.profileNames)
        ? p.profileNames.map(String)
        : Array.isArray(e.profileNames)
          ? e.profileNames
          : [],
    isAdmin: !!e.isAdmin,
  };
}
