const DICEBEAR_BASE = "https://api.dicebear.com/9.x/lorelei/svg";

const LORELEI_ROSTER = Object.freeze([
  "Kimberly",
  "Amaya",
  "Aidan",
  "Adrian",
  "Caleb",
  "George",
  "Sara",
  "Jameson",
]);

function rosterIndex(stableKey: string): number {
  const s = String(stableKey || "").trim();
  if (!s) return 0;
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % LORELEI_ROSTER.length;
}

export function loreleiPortraitSeedFromKey(stableKey: string): string {
  return LORELEI_ROSTER[rosterIndex(stableKey)];
}

export function dicebearPortraitUrl(seed: string): string {
  const raw = String(seed ?? "").trim();
  const pick = (LORELEI_ROSTER as readonly string[]).includes(raw)
    ? raw
    : loreleiPortraitSeedFromKey(raw);
  const params = new URLSearchParams();
  params.set("seed", pick);
  return `${DICEBEAR_BASE}?${params.toString()}`;
}

function stableUserKey(user: {
  id?: unknown;
  name?: string;
  email?: string;
} | null | undefined): string {
  if (!user || typeof user !== "object") return "guest";
  const id = user.id != null ? String(user.id).trim() : "";
  const email = String(user.email || "").trim().toLowerCase();
  const name = String(user.name || "").trim().toLowerCase();
  if (id || email) return `${id}|${email}`;
  if (name) return `name|${name}`;
  return "user";
}

export function dicebearSeedForUser(user: {
  id?: unknown;
  name?: string;
  email?: string;
} | null | undefined): string {
  return loreleiPortraitSeedFromKey(stableUserKey(user));
}
