"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  KeyRound,
  Mail,
  Search,
  Tag,
  Trash2,
  UserPlus,
  Users,
  X,
  Check,
} from "lucide-react";
import UserPeekNameRow from "./UserPeekNameRow";
import { badge, btn, card, C, input } from "@/lib/design/control-styles";
import { memberProfiles, memberTeams } from "@/lib/admin/helpers";
import type { WorkspaceUser } from "@/lib/workspace/cache";

type MemberEditKind = "email" | "password" | "teams" | "profiles";
type AssignmentKind = "profile" | "team";

function TeamChip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="ct-member-chip ct-member-chip--team"
      style={{
        borderColor: `${color}44`,
        background: `linear-gradient(165deg, ${color}22 0%, ${color}0d 100%)`,
        color: C.text,
      }}
    >
      <span className="ct-member-chip__dot" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

function ProfileChip({ label }: { label: string }) {
  return (
    <span className="ct-member-chip ct-member-chip--profile">
      <Tag size={11} strokeWidth={2.25} aria-hidden className="ct-member-chip__icon" />
      {label}
    </span>
  );
}

function ModalSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <div className="ct-catalog-search-wrap">
      <Search size={16} strokeWidth={1.75} aria-hidden className="ct-catalog-search-wrap__icon" />
      <input
        className="ct-input ct-catalog-search-wrap__input"
        style={input()}
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

function AssignmentSummaryRow({
  kind,
  items,
  memberLabel,
  onViewAll,
}: {
  kind: AssignmentKind;
  items: string[];
  memberLabel: string;
  onViewAll: () => void;
}) {
  if (items.length === 0) {
    return <span className="ct-member-table__muted">—</span>;
  }

  const isTeam = kind === "team";
  const unit = isTeam ? "team" : "profile";
  const countLabel = `${items.length} ${unit}${items.length === 1 ? "" : "s"}`;
  const Icon = isTeam ? Users : Tag;
  const detailTitle = items.join(", ");

  return (
    <button
      type="button"
      className={`ct-member-assign-badge ct-member-assign-badge--${kind}`}
      onClick={onViewAll}
      aria-label={`View all ${countLabel} for ${memberLabel}`}
      title={detailTitle}
    >
      <Icon size={12} strokeWidth={2.2} aria-hidden className="ct-member-assign-badge__icon" />
      <span className="ct-member-assign-badge__count">{items.length}</span>
    </button>
  );
}

function AssignmentViewModal({
  kind,
  open,
  memberLabel,
  items,
  teamColorFor,
  onClose,
}: {
  kind: AssignmentKind;
  open: boolean;
  memberLabel: string;
  items: string[];
  teamColorFor?: (name: string) => string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const isTeam = kind === "team";
  const unit = isTeam ? "team" : "profile";
  const title = isTeam ? "Assigned teams" : "Assigned profiles";
  const modalClass = isTeam ? "ct-member-teams-modal" : "ct-member-profiles-modal";
  const Icon = isTeam ? Users : Tag;

  const close = useCallback(() => {
    setSearch("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.toLowerCase().includes(q));
  }, [items, search]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      className="ct-admin-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`ct-member-${kind}-modal-title`}
        className={modalClass}
        style={card({
          padding: 0,
          maxWidth: 480,
          width: "100%",
          maxHeight: "min(88vh, 560px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
        })}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={`${modalClass}__head`}>
          <div className={`${modalClass}__head-text`}>
            <span className={`${modalClass}__icon`} aria-hidden>
              <Icon size={18} strokeWidth={2.1} />
            </span>
            <div>
              <h2 id={`ct-member-${kind}-modal-title`} className={`${modalClass}__title`}>
                {title}
              </h2>
              <p className={`${modalClass}__subtitle`}>
                {memberLabel} · {items.length} {unit}
                {items.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <button type="button" className="ct-catalog-modal__close" aria-label="Close" onClick={close}>
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className={`${modalClass}__body`}>
          {items.length > 8 ? (
            <ModalSearchField
              value={search}
              onChange={setSearch}
              placeholder={`Search ${unit}s…`}
              ariaLabel={`Search ${unit}s`}
            />
          ) : null}

          {search.trim() ? (
            <div className="ct-catalog-panel__filter-hint">
              Showing <strong>{filtered.length}</strong> of {items.length}
            </div>
          ) : null}

          <div className={`${modalClass}__scroll`}>
            {filtered.length === 0 ? (
              <p className="ct-catalog-empty">No {unit}s match your search.</p>
            ) : (
              <div className={`${modalClass}__grid`}>
                {filtered.map((item) =>
                  isTeam ? (
                    <TeamChip
                      key={item}
                      label={item}
                      color={teamColorFor ? teamColorFor(item) : "#2563eb"}
                    />
                  ) : (
                    <ProfileChip key={item} label={item} />
                  ),
                )}
              </div>
            )}
          </div>
        </div>

        <div className={`${modalClass}__foot`}>
          <button type="button" {...btn("ghost", { padding: "9px 18px" })} onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ActionIconBtn({
  label,
  shortLabel,
  onClick,
  danger = false,
  iconOnly = false,
  copied = false,
  icon,
}: {
  label: string;
  shortLabel?: string;
  onClick: () => void;
  danger?: boolean;
  iconOnly?: boolean;
  copied?: boolean;
  icon?: ReactNode;
}) {
  const icons: Record<string, ReactNode> = {
    "Edit Email": <Mail size={14} strokeWidth={2} aria-hidden />,
    "Edit Teams": <Users size={14} strokeWidth={2} aria-hidden />,
    "Edit Profiles": <Tag size={14} strokeWidth={2} aria-hidden />,
    "Change Password": <KeyRound size={14} strokeWidth={2} aria-hidden />,
    Copy: <Copy size={14} strokeWidth={2} aria-hidden />,
    Delete: <Trash2 size={14} strokeWidth={2} aria-hidden />,
  };

  const resolvedIcon = icon ?? icons[label] ?? (shortLabel ? icons[shortLabel] : null);

  return (
    <button
      type="button"
      className={[
        "ct-member-action-btn",
        danger ? "ct-member-action-btn--danger" : "",
        iconOnly ? "ct-member-action-btn--icon-only" : "",
        copied ? "ct-member-action-btn--copied" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={copied ? "Copied" : label}
      aria-label={copied ? "Copied" : label}
      onClick={onClick}
    >
      {copied ? (
        <Check size={14} strokeWidth={2.5} aria-hidden className="ct-member-action-btn__copied-icon" />
      ) : (
        resolvedIcon
      )}
      {!iconOnly ? (
        <span className="ct-member-action-btn__label">{shortLabel || label}</span>
      ) : null}
    </button>
  );
}

export default function MemberDetailsPanel({
  adminMemberTab,
  setAdminMemberTab,
  adminAnalystRows,
  adminMainLeadRows,
  teamColorFor,
  openMemberEditModal,
  copyUserCredentials,
  deleteUser,
  emailUpdatedId,
  teamsUpdatedId,
  profilesUpdatedId,
  passwordUpdatedId,
  copiedUserId,
  onAddUser,
  onManageProfiles,
  onManageTeams,
}: {
  adminMemberTab: "analyst" | "mainTeamLead";
  setAdminMemberTab: (tab: "analyst" | "mainTeamLead") => void;
  adminAnalystRows: WorkspaceUser[];
  adminMainLeadRows: WorkspaceUser[];
  teamColorFor: (name: string) => string;
  openMemberEditModal: (kind: MemberEditKind, user: WorkspaceUser) => void;
  copyUserCredentials: (user: WorkspaceUser) => void;
  deleteUser: (userId: string | number) => void;
  emailUpdatedId: string | number | null;
  teamsUpdatedId: string | number | null;
  profilesUpdatedId: string | number | null;
  passwordUpdatedId: string | number | null;
  copiedUserId: string | number | null;
  onAddUser: () => void;
  onManageProfiles: () => void;
  onManageTeams: () => void;
}) {
  const [assignmentView, setAssignmentView] = useState<{
    kind: AssignmentKind;
    memberLabel: string;
    items: string[];
  } | null>(null);

  const memberRows = adminMemberTab === "analyst" ? adminAnalystRows : adminMainLeadRows;

  const tabs = [
    { id: "analyst" as const, label: "Chat Analysts", count: adminAnalystRows.length },
    { id: "mainTeamLead" as const, label: "Main Team Leads", count: adminMainLeadRows.length },
  ];

  function rowStatus(userId: string | number) {
    if (emailUpdatedId === userId) return "Email updated.";
    if (teamsUpdatedId === userId) return "Teams updated.";
    if (profilesUpdatedId === userId) return "Profiles updated.";
    if (passwordUpdatedId === userId) return "Password updated.";
    return null;
  }

  return (
    <section className="ct-member-panel" style={card({ padding: "16px 18px" })}>
      <div className="ct-member-toolbar-row">
        <div className="ct-member-tabs" role="tablist" aria-label="Member role filter">
          {tabs.map((t) => {
            const active = adminMemberTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`ct-member-tab${active ? " ct-member-tab--active" : ""}`}
                onClick={() => setAdminMemberTab(t.id)}
              >
                {t.label}
                <span className="ct-member-tab__count">{t.count}</span>
              </button>
            );
          })}
        </div>

        <div className="ct-member-toolbar-row__actions">
          <button
            type="button"
            className="ct-admin-toolbar__btn"
            {...btn("primary", { padding: "9px 14px", fontSize: 12.5, minHeight: 38 })}
            onClick={onAddUser}
          >
            <UserPlus size={14} strokeWidth={2.25} aria-hidden className="ct-admin-toolbar__icon" />
            Add User
          </button>
          <button
            type="button"
            className="ct-admin-toolbar__btn"
            {...btn("primary", { padding: "9px 14px", fontSize: 12.5, minHeight: 38 })}
            onClick={onManageProfiles}
          >
            <Tag size={14} strokeWidth={2.25} aria-hidden className="ct-admin-toolbar__icon" />
            Manage Profiles
          </button>
          <button
            type="button"
            className="ct-admin-toolbar__btn"
            {...btn("primary", { padding: "9px 14px", fontSize: 12.5, minHeight: 38 })}
            onClick={onManageTeams}
          >
            <Users size={14} strokeWidth={2.25} aria-hidden className="ct-admin-toolbar__icon" />
            Manage Teams
          </button>
        </div>
      </div>

      <div className="ct-member-table-scroll">
        <table className="ct-member-table">
          <colgroup>
            <col className="ct-member-col ct-member-col--name" />
            <col className="ct-member-col ct-member-col--email" />
            <col className="ct-member-col ct-member-col--role" />
            <col className="ct-member-col ct-member-col--assign" />
            <col className="ct-member-col ct-member-col--assign" />
            <col className="ct-member-col ct-member-col--password" />
            <col className="ct-member-col ct-member-col--actions" />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th>
              <th>Login Email</th>
              <th>Role</th>
              <th className="ct-member-table__col-assign">Teams</th>
              <th className="ct-member-table__col-assign">Profiles</th>
              <th>Password</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {memberRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="ct-member-table__empty">
                  {adminMemberTab === "analyst"
                    ? "No chat analysts match your team roster or chats on your teams yet. Ensure your profile lists the correct teams, or that analysts have logs under those teams."
                    : "No Main Team Leads share a team with you yet."}
                </td>
              </tr>
            ) : (
              memberRows.map((u) => {
                const teamsList = memberTeams(u);
                const profilesList = memberProfiles(u);
                const memberLabel = u.name || u.email || "Member";
                const status = rowStatus(u.id);

                return (
                  <tr key={String(u.id)}>
                    <td className="ct-member-table__name">
                      <UserPeekNameRow
                        tint={teamColorFor(teamsList[0] || u.teamName || "")}
                        peekUser={u}
                        labelFallback={(u.name || "—").trim()}
                      >
                        <div className="ct-member-table__name-text">{u.name || "—"}</div>
                      </UserPeekNameRow>
                    </td>
                    <td className="ct-member-table__email">
                      <span className="ct-member-table__email-text">{u.email || "—"}</span>
                    </td>
                    <td className="ct-member-table__role">
                      <span className="ct-member-table__role-wrap">
                        {badge(
                          u.role === "analyst" ? "Chat Analyst" : "Main Team Lead",
                          u.role === "analyst" ? C.violet : C.cyan,
                        )}
                      </span>
                    </td>
                    <td className="ct-member-table__assignments">
                      <AssignmentSummaryRow
                        kind="team"
                        items={teamsList}
                        memberLabel={memberLabel}
                        onViewAll={() =>
                          setAssignmentView({ kind: "team", memberLabel, items: teamsList })
                        }
                      />
                    </td>
                    <td className="ct-member-table__assignments">
                      <AssignmentSummaryRow
                        kind="profile"
                        items={profilesList}
                        memberLabel={memberLabel}
                        onViewAll={() =>
                          setAssignmentView({ kind: "profile", memberLabel, items: profilesList })
                        }
                      />
                    </td>
                    <td className="ct-member-table__password">
                      {String(u.password ?? "").trim() ? (
                        <code className="ct-member-password-value">{u.password}</code>
                      ) : (
                        <span className="ct-member-table__muted">—</span>
                      )}
                    </td>
                    <td className="ct-member-table__actions">
                      <div className="ct-member-actions">
                        <div className="ct-member-actions__group">
                          <ActionIconBtn
                            label="Edit Email"
                            shortLabel="Email"
                            onClick={() => openMemberEditModal("email", u)}
                          />
                          <ActionIconBtn
                            label="Edit Teams"
                            shortLabel="Teams"
                            onClick={() => openMemberEditModal("teams", u)}
                          />
                          <ActionIconBtn
                            label="Edit Profiles"
                            shortLabel="Profiles"
                            onClick={() => openMemberEditModal("profiles", u)}
                          />
                          <ActionIconBtn
                            label="Change Password"
                            shortLabel="Password"
                            onClick={() => openMemberEditModal("password", u)}
                          />
                        </div>
                        <ActionIconBtn
                          label="Copy credentials (email, password, teams, profiles)"
                          icon={<Copy size={14} strokeWidth={2} aria-hidden />}
                          iconOnly
                          copied={copiedUserId != null && String(copiedUserId) === String(u.id)}
                          onClick={() => copyUserCredentials(u)}
                        />
                        <ActionIconBtn
                          label="Delete"
                          shortLabel="Delete"
                          danger
                          onClick={() => deleteUser(u.id)}
                        />
                      </div>
                      {status ? (
                        <div className="ct-member-table__status" role="status">
                          {status}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AssignmentViewModal
        kind={assignmentView?.kind || "profile"}
        open={Boolean(assignmentView)}
        memberLabel={assignmentView?.memberLabel || ""}
        items={assignmentView?.items || []}
        teamColorFor={teamColorFor}
        onClose={() => setAssignmentView(null)}
      />
    </section>
  );
}
