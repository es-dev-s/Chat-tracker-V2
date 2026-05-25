"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { C, RAD } from "@/lib/design/tokens";
import {
  buildNotifications,
  NOTIFICATIONS_POPOVER_LIMIT,
} from "@/lib/notifications/build-notifications";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function NotificationsPopover({ role }: { role: string }) {
  const router = useRouter();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const records = useWorkspaceStore((s) => s.records);
  const dismissedNotifs = useWorkspaceStore((s) => s.dismissedNotifs);
  const notifUserKey = useWorkspaceStore((s) => s.notifUserKey);
  const dismissNotification = useWorkspaceStore((s) => s.dismissNotification);
  const dismissAllNotifications = useWorkspaceStore((s) => s.dismissAllNotifications);

  const dismissed = dismissedNotifs[notifUserKey] || [];
  const undismissed = useMemo(
    () => buildNotifications(records, dismissed, role),
    [records, dismissed, role],
  );
  const notifications = useMemo(
    () => undismissed.slice(0, NOTIFICATIONS_POPOVER_LIMIT),
    [undismissed],
  );
  const totalCount = undismissed.length;

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (event: MouseEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onDocKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [open]);

  return (
    <div style={{ position: "relative", zIndex: 8000 }} ref={popoverRef}>
      <button
        type="button"
        className="ct-top-action-btn ct-notif-trigger"
        onClick={() => setOpen((s) => !s)}
        title="Notifications"
        aria-expanded={open}
        aria-label={
          totalCount ? `Notifications, ${totalCount} unread` : "Notifications"
        }
      >
        <Bell size={16} strokeWidth={2} aria-hidden />
        {totalCount > 0 ? (
          <span className="ct-notif-badge">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="region"
          aria-label="Notifications"
          style={{
            position: "absolute",
            top: 48,
            right: 0,
            width: "min(408px, calc(100vw - 24px))",
            zIndex: 8400,
            borderRadius: RAD.lg,
            border: `1px solid ${C.border}`,
            background: C.surface,
            boxShadow:
              "0 20px 50px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(255,255,255,0.06) inset",
            overflow: "hidden",
          }}
        >
          <div className="ct-notif-header">
            <div style={{ minWidth: 0 }}>
              <div className="ct-notif-title">Notifications</div>
              <div className="ct-notif-sub">
                {totalCount === 0
                  ? "Note updates on chats you can see."
                  : `${totalCount} unread`}
              </div>
            </div>
            {totalCount > 0 ? (
              <button
                type="button"
                className="ct-btn-ghost ct-notif-mark-all"
                onClick={() => {
                  void dismissAllNotifications(role).then(() => setOpen(false));
                }}
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {totalCount === 0 ? (
            <div className="ct-notif-empty">
              When an analyst or main lead edits a note on a record in your scope,
              it shows here so you can open the right screen.
            </div>
          ) : (
            <ul className="ct-notif-list">
              {notifications.map((n) => {
                const leadName = (n.profile && String(n.profile).trim()) || "—";
                const analystName = (n.rowAnalyst && String(n.rowAnalyst).trim()) || "—";
                const line = `Analyst : ${analystName} - ${leadName}`;
                return (
                  <li key={n.id} className="ct-notif-item">
                    <button
                      type="button"
                      className="ct-btn-bare ct-notif-open"
                      onClick={() => {
                        if (n.targetPath) router.push(n.targetPath);
                        setOpen(false);
                      }}
                      aria-label={`Open notification: ${line}`}
                      title={line}
                    >
                      <span className="ct-notif-line">{line}</span>
                    </button>
                    <div className="ct-notif-dismiss-wrap">
                      <button
                        type="button"
                        aria-label="Dismiss this notification"
                        className="ct-btn-bare ct-notif-dismiss"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void dismissNotification(n.id).then(() => {
                            if (totalCount <= 1) setOpen(false);
                          });
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
