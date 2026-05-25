"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { TAB_TO_PATH, tabsForRole, roleLabel, type TabId } from "@/lib/auth/routes";
import { TAB_META } from "@/lib/layout/tab-meta";
import { analystColorFor } from "@/lib/design/colors";
import type { SessionUser } from "@/lib/auth/constants";
import { makeDisplayName } from "@/lib/utils/display-name";
import { dicebearSeedForUser } from "@/lib/utils/dicebear";
import { initialsForPeek } from "@/lib/utils/user-display";
import AvatarMark from "@/components/ui/AvatarMark";
import { useGlobalFiltersActiveCount } from "./GlobalFiltersPanel";
import { useSidebarStore } from "@/store/sidebar-store";

const FILTER_AWARE_TABS = new Set<TabId>(["dashboard", "records", "notes", "leads", "leadNotes"]);

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const tabs = tabsForRole(user.role);
  const displayName = makeDisplayName(user);
  const activeFilterCount = useGlobalFiltersActiveCount();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const ready = useSidebarStore((s) => s.ready);
  const toggle = useSidebarStore((s) => s.toggle);

  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={`ct-sidebar${collapsed ? " ct-sidebar--collapsed" : ""}${ready ? " ct-sidebar--ready" : ""}`}
      aria-label="Main navigation"
    >
      <nav className="ct-sidebar-nav">
        {tabs.map((tabId) => {
          const { label, Icon } = TAB_META[tabId];
          const href = TAB_TO_PATH[tabId];
          const isActive = pathname === href;
          const showFilterDot = FILTER_AWARE_TABS.has(tabId) && activeFilterCount > 0;

          return (
            <Link
              key={tabId}
              href={href}
              className={`ct-nav-link${isActive ? " ct-nav-link-active" : ""}`}
              title={collapsed ? label : undefined}
            >
              <span className="ct-nav-link-icon">
                <span
                  className={`ct-nav-link-icon__glyph${isActive ? " ct-nav-link-icon__glyph--active" : ""}`}
                >
                  <Icon aria-hidden size={17} strokeWidth={isActive ? 2.1 : 1.75} />
                </span>
                {showFilterDot ? (
                  <span className="ct-nav-filter-dot ct-nav-filter-dot--corner" aria-hidden />
                ) : null}
              </span>
              <span className="ct-nav-link-body">
                <span className="ct-nav-link-label">{label}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="ct-sidebar-spacer" />

      <button
        type="button"
        className="ct-sidebar-collapse-btn"
        onClick={toggle}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <span className="ct-sidebar-collapse-btn__icon">
          <span className="ct-sidebar-collapse-btn__glyph">
            <CollapseIcon size={17} strokeWidth={2.15} aria-hidden />
          </span>
        </span>
        <span className="ct-sidebar-collapse-btn__label">
          {collapsed ? "Expand sidebar" : "Collapse sidebar"}
        </span>
      </button>

      <div className="ct-sidebar-foot">
        <div
          className="ct-sidebar-user"
          title={`${displayName}${user.email ? ` · ${user.email}` : ""} · ${roleLabel(user.role)}`}
        >
          <span className="ct-sidebar-user__icon">
            <AvatarMark
              tint={analystColorFor(displayName || user.email || "")}
              initials={initialsForPeek(displayName || user.email || "—")}
              avatarSeed={dicebearSeedForUser(user)}
              size={26}
              eager
            />
          </span>
          <span className="ct-sidebar-user__text" aria-hidden={collapsed}>
            <span className="ct-sidebar-user__name">{displayName}</span>
            <span className="ct-sidebar-user__role">{roleLabel(user.role)}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
