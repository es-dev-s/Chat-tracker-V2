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
  whatsappAudit: "/whatsapp-audit",
  logWhatsappAudit: "/log-whatsapp-audit",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export type TabId =
  | "dashboard"
  | "log"
  | "records"
  | "notes"
  | "admin"
  | "leads"
  | "leadNotes"
  | "whatsappAudit"
  | "logWhatsappAudit";

export const TAB_TO_PATH: Record<TabId, AppRoute> = {
  dashboard: ROUTES.dashboard,
  log: ROUTES.log,
  records: ROUTES.records,
  notes: ROUTES.notes,
  admin: ROUTES.admin,
  leads: ROUTES.leads,
  leadNotes: ROUTES.leadNotes,
  whatsappAudit: ROUTES.whatsappAudit,
  logWhatsappAudit: ROUTES.logWhatsappAudit,
};

export const PATH_TO_TAB: Record<string, TabId> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tabId, path]) => [path, tabId as TabId]),
);

/**
 * `isAdmin` marks a super admin (unrestricted team lead).
 * WhatsApp Audit: analysts log entries on `logWhatsappAudit`; main team leads and
 * super admins review them on `whatsappAudit`.
 */
export function tabsForRole(role: UserRole | string, isAdmin = false): TabId[] {
  if (role === "teamLead") {
    return isAdmin
      ? ["dashboard", "records", "notes", "admin", "whatsappAudit"]
      : ["dashboard", "records", "notes", "admin"];
  }
  if (role === "mainTeamLead") {
    return ["dashboard", "records", "leads", "leadNotes", "whatsappAudit"];
  }
  return ["dashboard", "log", "logWhatsappAudit", "records", "notes"];
}

export function routeAllowedForRole(
  pathname: string,
  role: UserRole | string,
  isAdmin = false,
): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.replace(/\/+$/, "")
      : pathname;
  const tab = PATH_TO_TAB[normalized];
  if (!tab) return normalized === ROUTES.dashboard;
  return tabsForRole(role, isAdmin).includes(tab);
}

export function roleLabel(role: UserRole | string): string {
  if (role === "teamLead") return "Chat Analyst Team Lead";
  if (role === "mainTeamLead") return "Main Team Lead";
  if (role === "analyst") return "Chat Analyst";
  return "User";
}
