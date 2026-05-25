import type { SessionUser } from "@/lib/auth/constants";

export function makeDisplayName(user: Partial<SessionUser> = {}): string {
  const explicit = (user.name || "").trim();
  if (explicit) return explicit;
  const emailPrefix = (user.email || "")
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();
  if (emailPrefix) {
    return emailPrefix
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  if (user.role === "mainTeamLead") return "Main Team Lead";
  if (user.role === "teamLead") return "Chat Analyst Team Lead";
  if (user.role === "analyst") return "Chat Analyst";
  return "User";
}
