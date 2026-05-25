import { C } from "@/lib/design/tokens";

export const TEAM_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0d9488",
  "#d97706",
  "#db2777",
  "#14b8a6",
  "#4f46e5",
  "#0891b2",
];

export const ANALYST_COLORS = [
  "#0ea5e9",
  "#6366f1",
  "#14b8a6",
  "#f59e0b",
  "#e11d48",
  "#8b5cf6",
  "#16a34a",
  "#0284c7",
];

export function teamColorFor(teamName = ""): string {
  const key = String(teamName).trim().toLowerCase();
  if (!key) return C.cyan;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % TEAM_COLORS.length;
  }
  return TEAM_COLORS[hash];
}

export function analystColorFor(analystName = ""): string {
  const key = String(analystName).trim().toLowerCase();
  if (!key) return C.violet;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 33 + key.charCodeAt(i)) % ANALYST_COLORS.length;
  }
  return ANALYST_COLORS[hash];
}
