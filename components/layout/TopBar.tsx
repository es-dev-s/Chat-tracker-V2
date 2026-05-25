"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { roleLabel, ROUTES, type TabId } from "@/lib/auth/routes";
import { TAB_META } from "@/lib/layout/tab-meta";
import type { SessionUser } from "@/lib/auth/constants";
import { useAuthStore } from "@/store/auth-store";
import NotificationsPopover from "./NotificationsPopover";

export default function TopBar({
  user,
  activeTab,
}: {
  user: SessionUser;
  activeTab: TabId;
}) {
  const logout = useAuthStore((s) => s.logout);
  const { label, Icon } = TAB_META[activeTab] ?? TAB_META.dashboard;
  const displayName = user.name?.trim() || "User";

  return (
    <header className="ct-top-chrome">
      <div className="ct-top-chrome-brand">
        <Link href={ROUTES.dashboard} className="ct-top-brand" aria-label="Chat Tracker home">
          <span className="ct-top-brand__logo-slot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/chat-tracker-logo.svg"
              alt=""
              width={28}
              height={28}
              className="ct-top-brand__logo"
            />
          </span>
          <span className="ct-top-brand__text">
            <span className="ct-top-brand__title">Chat Tracker</span>
            <span className="ct-top-brand__tag">Operations</span>
          </span>
        </Link>
      </div>

      <div className="ct-top-chrome-main">
        <div className="ct-top-page-head">
          <span className="ct-top-page-title__icon-wrap" aria-hidden>
            <Icon size={16} strokeWidth={2.05} className="ct-top-page-title__icon" />
          </span>
          <h1 className="ct-top-page-title__label">{label}</h1>
        </div>

        <div className="ct-top-chrome-actions">
          <NotificationsPopover role={user.role} />

          <div className="ct-top-user-chip">
            <span className="ct-top-user-chip__name">{displayName}</span>
            <span className="ct-top-user-chip__role">{roleLabel(user.role)}</span>
          </div>

          <button
            type="button"
            className="ct-top-action-btn ct-top-action-btn--logout"
            onClick={() => void logout()}
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={16} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
