import { resolveCatalogName } from "./catalog-names";
import { readTeams } from "./catalogs";

/**
 * Force chat_records.team onto the catalog's exact spelling so case-variants
 * cannot reappear through log/edit flows.
 */
export async function withCanonicalRecordTeam<T extends Record<string, unknown>>(
  row: T,
): Promise<T> {
  const rawTeam = String(row.team ?? "").trim();
  if (!rawTeam) return row;
  const teams = await readTeams();
  const canonical = resolveCatalogName(rawTeam, teams);
  if (!canonical) throw new Error("TEAM_NOT_IN_CATALOG");
  if (canonical === rawTeam && row.team === canonical) return row;
  return { ...row, team: canonical };
}
