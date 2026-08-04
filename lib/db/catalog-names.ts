/** Case-insensitive catalog lookup; returns the catalog's exact spelling. */
export function resolveCatalogName(
  input: unknown,
  catalog: readonly string[],
): string | null {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  for (const entry of catalog) {
    const name = String(entry ?? "").trim();
    if (name && name.toLowerCase() === key) return name;
  }
  return null;
}

/** Remap names to catalog casing; drop empties; dedupe case-insensitively. */
export function canonicalizeNameList(
  names: unknown,
  catalog: readonly string[],
): string[] {
  const raw = Array.isArray(names) ? names : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const trimmed = String(item ?? "").trim();
    if (!trimmed) continue;
    const resolved = resolveCatalogName(trimmed, catalog) ?? trimmed;
    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resolved);
  }
  return out;
}

export function findCaseInsensitiveDuplicate(
  input: unknown,
  existing: readonly string[],
): string | null {
  const trimmed = String(input ?? "").trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  for (const entry of existing) {
    const name = String(entry ?? "").trim();
    if (name && name.toLowerCase() === key) return name;
  }
  return null;
}
