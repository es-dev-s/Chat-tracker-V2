import type { UserRole } from "../db/users";

export const ROUTES = {
  login: "/login",
  dashboard: "/dashboard",
  log: "/log",
  records: "/records",
  notes: "/notes",
  admin: "/admin",
  leads: "/leads",
  leadNotes: "/lead-notes",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export type TabId =
  | "dashboard"
  | "log"
  | "records"
  | "notes"
  | "admin"
  | "leads"
  | "leadNotes";

export const TAB_TO_PATH: Record<TabId, AppRoute> = {
  dashboard: ROUTES.dashboard,
  log: ROUTES.log,
  records: ROUTES.records,
  notes: ROUTES.notes,
  admin: ROUTES.admin,
  leads: ROUTES.leads,
  leadNotes: ROUTES.leadNotes,
};

export const PATH_TO_TAB: Record<string, TabId> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tabId, path]) => [path, tabId as TabId]),
);

export function tabsForRole(role: UserRole | string): TabId[] {
  if (role === "teamLead") {
    return ["dashboard", "records", "notes", "admin"];
  }
  if (role === "mainTeamLead") {
    return ["dashboard", "leads", "leadNotes"];
  }
  return ["dashboard", "log", "records", "notes"];
}

export function routeAllowedForRole(
  pathname: string,
  role: UserRole | string,
): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.replace(/\/+$/, "")
      : pathname;
  const tab = PATH_TO_TAB[normalized];
  if (!tab) return normalized === ROUTES.dashboard;
  return tabsForRole(role).includes(tab);
}

export function roleLabel(role: UserRole | string): string {
  if (role === "teamLead") return "Chat Analyst Team Lead";
  if (role === "mainTeamLead") return "Main Team Lead";
  if (role === "analyst") return "Chat Analyst";
  return "User";
}
