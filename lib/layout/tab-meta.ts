import {
  BookMarked,
  LayoutDashboard,
  MessageSquarePlus,
  NotebookPen,
  Table2,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { TabId } from "@/lib/auth/routes";

export type TabMeta = {
  label: string;
  Icon: LucideIcon;
};

export const TAB_META: Record<TabId, TabMeta> = {
  dashboard: {
    label: "Dashboard",
    Icon: LayoutDashboard,
  },
  log: {
    label: "Log Chat",
    Icon: MessageSquarePlus,
  },
  records: {
    label: "Records",
    Icon: Table2,
  },
  notes: {
    label: "Notes",
    Icon: NotebookPen,
  },
  admin: {
    label: "User & Teams",
    Icon: UserCog,
  },
  leads: {
    label: "All Leads",
    Icon: Users,
  },
  leadNotes: {
    label: "Notes",
    Icon: BookMarked,
  },
};

export function tabLabel(tabId: TabId): string {
  return TAB_META[tabId]?.label ?? "Dashboard";
}
