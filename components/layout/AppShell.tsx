"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  PATH_TO_TAB,
  ROUTES,
  routeAllowedForRole,
  type TabId,
} from "@/lib/auth/routes";
import type { SessionUser } from "@/lib/auth/constants";
import { useSidebarStore } from "@/store/sidebar-store";
import Sidebar from "./Sidebar";
import FilterSidebar from "./FilterSidebar";
import TopBar from "./TopBar";

export default function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useSidebarStore((s) => s.collapsed);
  const ready = useSidebarStore((s) => s.ready);
  const hydrate = useSidebarStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!routeAllowedForRole(pathname, user.role)) {
      router.replace(ROUTES.dashboard);
    }
  }, [pathname, user.role, router]);

  const tab = (PATH_TO_TAB[pathname] ?? "dashboard") as TabId;

  return (
    <div
      className={`ct-app-root${collapsed ? " ct-sidebar-collapsed" : ""}${ready ? " ct-sidebar-ready" : ""}`}
    >
      <TopBar user={user} activeTab={tab} />
      <div className="ct-app-body">
        <Sidebar user={user} />
        <div className="ct-app-main-col">
          <div className="ct-page-shell">{children}</div>
        </div>
        <FilterSidebar />
      </div>
    </div>
  );
}
