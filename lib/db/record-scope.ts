import type { AppUser } from "./users";
import {
  analystIdentityKeys,
  getUserTeamsList,
  isUnrestrictedTeamLead,
} from "@/lib/auth/scoping";

type ScopedQuery = {
  eq: (column: string, value: unknown) => ScopedQuery;
  in: (column: string, values: readonly string[]) => ScopedQuery;
  or: (filters: string) => ScopedQuery;
};

/** Push role-based filters into Supabase queries (indexed columns where possible). */
export function applyRecordScopeToQuery<T extends ScopedQuery>(
  query: T,
  viewer: Partial<AppUser>,
): T {
  const role = viewer?.role;
  if (!role) return query.eq("id", -1) as T;

  if (role === "teamLead" && isUnrestrictedTeamLead(viewer)) {
    return query;
  }

  if (role === "teamLead" || role === "mainTeamLead") {
    const teams = getUserTeamsList(viewer);
    if (!teams.length) return query.eq("id", -1) as T;
    return query.in("team", teams) as T;
  }

  if (role === "analyst") {
    const teams = getUserTeamsList(viewer);
    const keys = [...analystIdentityKeys(viewer)];
    const orClauses: string[] = [];

    for (const key of keys) {
      if (key) orClauses.push(`analyst.ilike.${key}`);
    }
    for (const team of teams) {
      if (team) {
        orClauses.push(`and(team.eq.${team},lead_note.neq.)`);
      }
    }

    if (!orClauses.length) return query.eq("id", -1) as T;
    return query.or(orClauses.join(",")) as T;
  }

  return query.eq("id", -1) as T;
}
