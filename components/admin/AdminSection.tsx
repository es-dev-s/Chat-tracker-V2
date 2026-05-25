"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, Search, X } from "lucide-react";
import CatalogPanel from "./CatalogPanel";
import MemberDetailsPanel from "./MemberDetailsPanel";
import { DismissiblePillChip, OutlineTeamPickerChip } from "./TeamManagementChips";
import { BusyLabel } from "@/components/ui/BusySpinner";
import {
  btn,
  card,
  C,
  input,
  MONO,
  RAD,
} from "@/lib/design/control-styles";
import type { WorkspaceUser } from "@/lib/workspace/cache";

type LatestCreds = {
  role: string;
  name: string;
  email: string;
  password: string;
  teamName?: string;
  teamNames?: string[];
  profileNames?: string[];
};

type ConfirmModal =
  | { kind: "catalogTeam"; teamName: string }
  | { kind: "memberTeam"; userId: string | number; teamName: string; memberLabel: string };

type MemberEditModal = {
  kind: "email" | "password" | "teams" | "profiles";
  userId: string | number;
};

export type AdminSectionProps = {
  adminAddRole: "analyst" | "mainTeamLead";
  setAdminAddRole: (role: "analyst" | "mainTeamLead") => void;
  newUserName: string;
  setNewUserName: (v: string) => void;
  newAnalystEmail: string;
  setNewAnalystEmail: (v: string) => void;
  newAnalystPassword: string;
  setNewAnalystPassword: (v: string) => void;
  newUserTeamNames: string[];
  toggleNewUserTeamName: (team: string) => void;
  newUserProfileNames: string[];
  setNewUserProfileNames: (names: string[]) => void;
  toggleNewUserProfileName: (profile: string) => void;
  teams: string[];
  createUser: () => Promise<boolean>;
  userSaved: boolean;
  latestCreds: LatestCreds | null;
  userError: string;
  copyLatestCredentials: () => void;
  latestCredsCopied: boolean;
  newTeamName: string;
  setNewTeamName: (v: string) => void;
  addTeamName: () => Promise<boolean>;
  teamSaved: boolean;
  newProfileName: string;
  setNewProfileName: (v: string) => void;
  addProfileName: () => Promise<boolean>;
  removeProfileName: (name: string) => Promise<boolean>;
  profileSaved: boolean;
  profiles: string[];
  removeTeamName: (name: string) => Promise<boolean>;
  adminAnalystRows: WorkspaceUser[];
  adminMainLeadRows: WorkspaceUser[];
  adminMemberTab: "analyst" | "mainTeamLead";
  setAdminMemberTab: (tab: "analyst" | "mainTeamLead") => void;
  emailDrafts: Record<string | number, string>;
  setEmailDrafts: Dispatch<SetStateAction<Record<string | number, string>>>;
  updateUserEmail: (userId: string | number) => Promise<boolean>;
  emailUpdatedId: string | number | null;
  passwordDrafts: Record<string | number, string>;
  setPasswordDrafts: Dispatch<SetStateAction<Record<string | number, string>>>;
  updateUserPassword: (userId: string | number) => Promise<boolean>;
  passwordUpdatedId: string | number | null;
  copyUserCredentials: (user: WorkspaceUser) => void;
  copiedUserId: string | number | null;
  deleteUser: (userId: string | number) => void;
  teamColorFor: (teamName: string) => string;
  memberTeamsDraft: Record<string | number, string[]>;
  teamsUpdatedId: string | number | null;
  beginEditMemberTeams: (userId: string | number) => void;
  cancelMemberTeamsEdit: () => void;
  toggleMemberTeamDraft: (userId: string | number, team: string) => void;
  saveMemberTeams: (userId: string | number) => Promise<boolean>;
  removeMemberTeam: (userId: string | number, teamName: string) => void;
  memberProfilesDraft: Record<string | number, string[]>;
  profilesUpdatedId: string | number | null;
  beginEditMemberProfiles: (userId: string | number) => void;
  cancelMemberProfilesEdit: () => void;
  toggleMemberProfileDraft: (userId: string | number, name: string) => void;
  saveMemberProfiles: (userId: string | number) => Promise<boolean>;
};

export default function AdminSection(props: AdminSectionProps) {
  const {
    adminAddRole,
    setAdminAddRole,
    newUserName,
    setNewUserName,
    newAnalystEmail,
    setNewAnalystEmail,
    newAnalystPassword,
    setNewAnalystPassword,
    newUserTeamNames,
    toggleNewUserTeamName,
    newUserProfileNames,
    setNewUserProfileNames,
    toggleNewUserProfileName,
    teams,
    createUser,
    userSaved,
    latestCreds,
    userError,
    copyLatestCredentials,
    latestCredsCopied,
    newTeamName,
    setNewTeamName,
    addTeamName,
    teamSaved,
    newProfileName,
    setNewProfileName,
    addProfileName,
    removeProfileName,
    profileSaved,
    profiles,
    removeTeamName,
    adminAnalystRows,
    adminMainLeadRows,
    adminMemberTab,
    setAdminMemberTab,
    emailDrafts,
    setEmailDrafts,
    updateUserEmail,
    emailUpdatedId,
    passwordDrafts,
    setPasswordDrafts,
    updateUserPassword,
    passwordUpdatedId,
    copyUserCredentials,
    copiedUserId,
    deleteUser,
    teamColorFor,
    memberTeamsDraft,
    teamsUpdatedId,
    beginEditMemberTeams,
    cancelMemberTeamsEdit,
    toggleMemberTeamDraft,
    saveMemberTeams,
    removeMemberTeam,
    memberProfilesDraft,
    profilesUpdatedId,
    beginEditMemberProfiles,
    cancelMemberProfilesEdit,
    toggleMemberProfileDraft,
    saveMemberProfiles,
  } = props;

  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [profileCatalogOpen, setProfileCatalogOpen] = useState(false);
  const [teamCatalogOpen, setTeamCatalogOpen] = useState(false);
  const [sidePicker, setSidePicker] = useState<"teams" | "profiles" | null>(null);
  const [profilePickerQuery, setProfilePickerQuery] = useState("");
  const [catalogProfileSearch, setCatalogProfileSearch] = useState("");
  const [catalogTeamSearch, setCatalogTeamSearch] = useState("");
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);
  const [memberEditModal, setMemberEditModal] = useState<MemberEditModal | null>(null);
  const [memberEditBusy, setMemberEditBusy] = useState(false);
  const [createUserBusy, setCreateUserBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const selectedTeamSummary = newUserTeamNames.length
    ? `${newUserTeamNames.length} team${newUserTeamNames.length > 1 ? "s" : ""} selected`
    : "Select team(s)";

  const PROFILE_PICKER_MAX_ROWS = 250;
  const profileAddUserSearchResults = useMemo(() => {
    const q = profilePickerQuery.trim().toLowerCase();
    if (!q) return { rows: [] as string[], total: 0, capped: false };
    const matches: string[] = [];
    for (const p of profiles) {
      const s = String(p);
      if (s.toLowerCase().includes(q)) matches.push(s);
    }
    matches.sort((a, b) => {
      const al = a.toLowerCase();
      const bl = b.toLowerCase();
      const ia = al.indexOf(q);
      const ib = bl.indexOf(q);
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
    const capped = matches.length > PROFILE_PICKER_MAX_ROWS;
    return {
      rows: capped ? matches.slice(0, PROFILE_PICKER_MAX_ROWS) : matches,
      total: matches.length,
      capped,
    };
  }, [profiles, profilePickerQuery]);

  const catalogProfilesFiltered = useMemo(() => {
    const q = catalogProfileSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => String(p).toLowerCase().includes(q));
  }, [profiles, catalogProfileSearch]);

  const catalogTeamsFiltered = useMemo(() => {
    const q = catalogTeamSearch.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => String(t).toLowerCase().includes(q));
  }, [teams, catalogTeamSearch]);

  const closeAddUserModal = useCallback(() => {
    setAddUserModalOpen(false);
    setSidePicker(null);
    setProfilePickerQuery("");
  }, []);

  const closeProfileCatalog = useCallback(() => {
    setProfileCatalogOpen(false);
    setCatalogProfileSearch("");
  }, []);

  const closeTeamCatalog = useCallback(() => {
    setTeamCatalogOpen(false);
    setCatalogTeamSearch("");
  }, []);

  useEffect(() => {
    if (
      !confirmModal &&
      !addUserModalOpen &&
      !profileCatalogOpen &&
      !teamCatalogOpen &&
      !memberEditModal
    ) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConfirmModal(null);
        closeAddUserModal();
        closeProfileCatalog();
        closeTeamCatalog();
        setMemberEditModal((prev) => {
          if (prev?.kind === "teams") cancelMemberTeamsEdit();
          if (prev?.kind === "profiles") cancelMemberProfilesEdit();
          return null;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    confirmModal,
    addUserModalOpen,
    profileCatalogOpen,
    teamCatalogOpen,
    memberEditModal,
    closeAddUserModal,
    closeProfileCatalog,
    closeTeamCatalog,
    cancelMemberTeamsEdit,
    cancelMemberProfilesEdit,
  ]);

  const openMemberEditModal = (kind: MemberEditModal["kind"], user: WorkspaceUser) => {
    if (!user) return;
    if (kind === "email") {
      setEmailDrafts((prev) => ({ ...prev, [user.id]: user.email || "" }));
    } else if (kind === "password") {
      setPasswordDrafts((prev) => ({ ...prev, [user.id]: "" }));
    } else if (kind === "teams") {
      beginEditMemberTeams(user.id);
    } else if (kind === "profiles") {
      beginEditMemberProfiles(user.id);
    }
    setMemberEditModal({ kind, userId: user.id });
  };

  function closeMemberEditModal() {
    if (memberEditModal?.kind === "teams") cancelMemberTeamsEdit();
    if (memberEditModal?.kind === "profiles") cancelMemberProfilesEdit();
    setMemberEditModal(null);
  }

  async function runMemberEditSave(action: () => Promise<boolean>) {
    if (memberEditBusy) return;
    setMemberEditBusy(true);
    try {
      const ok = await action();
      if (ok) closeMemberEditModal();
    } finally {
      setMemberEditBusy(false);
    }
  }

  const memberRows = adminMemberTab === "analyst" ? adminAnalystRows : adminMainLeadRows;
  const activeMember = memberEditModal
    ? memberRows.find((u) => String(u.id) === String(memberEditModal.userId))
    : null;

  return (
    <div style={{ width: "100%", maxWidth: "none", margin: "0 auto" }}>
      <CatalogPanel
        tone="profile"
        open={profileCatalogOpen}
        onOpenChange={(next) => (next ? setProfileCatalogOpen(true) : closeProfileCatalog())}
        items={profiles}
        filteredItems={catalogProfilesFiltered}
        search={catalogProfileSearch}
        onSearchChange={setCatalogProfileSearch}
        newName={newProfileName}
        onNewNameChange={setNewProfileName}
        onAdd={addProfileName}
        onRemove={removeProfileName}
        savedFlash={profileSaved}
        savedMessage="Profile list updated."
      />
      <CatalogPanel
        tone="team"
        open={teamCatalogOpen}
        onOpenChange={(next) => (next ? setTeamCatalogOpen(true) : closeTeamCatalog())}
        items={teams}
        filteredItems={catalogTeamsFiltered}
        search={catalogTeamSearch}
        onSearchChange={setCatalogTeamSearch}
        newName={newTeamName}
        onNewNameChange={setNewTeamName}
        onAdd={addTeamName}
        onRemove={(teamName) => {
          setConfirmModal({ kind: "catalogTeam", teamName });
          return false;
        }}
        savedFlash={teamSaved}
        savedMessage="Team added."
        teamColorFor={teamColorFor}
      />
      {userSaved ? (
        <div style={{ color: C.green, fontSize: 12, marginBottom: 10 }}>
          User created successfully as{" "}
          {latestCreds?.role === "mainTeamLead" ? "Main Team Lead" : "Chat Analyst"}.
        </div>
      ) : null}
      {userError ? (
        <div style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{userError}</div>
      ) : null}
      {latestCreds ? (
        <div style={{ marginBottom: 14, fontSize: 12.5, color: C.label }}>
          Share: <span style={{ fontFamily: MONO, color: C.text }}>{latestCreds.role}</span> |{" "}
          <span style={{ fontFamily: MONO, color: C.text }}>{latestCreds.name}</span> |{" "}
          <span style={{ fontFamily: MONO, color: C.text }}>{latestCreds.email}</span> /{" "}
          <span style={{ fontFamily: MONO, color: C.text }}>{latestCreds.password}</span> | Team:{" "}
          <span style={{ fontFamily: MONO, color: C.text }}>
            {(latestCreds.teamNames || []).join(", ") || latestCreds.teamName}
          </span>{" "}
          | Profile:{" "}
          <span style={{ fontFamily: MONO, color: C.text }}>
            {(latestCreds.profileNames || []).join(", ") || "—"}
          </span>
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className={[
                "ct-member-action-btn",
                "ct-member-action-btn--icon-only",
                latestCredsCopied ? "ct-member-action-btn--copied" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ height: 32, minWidth: 36 }}
              title={latestCredsCopied ? "Copied" : "Copy all credentials"}
              aria-label={latestCredsCopied ? "Copied" : "Copy all credentials"}
              onClick={copyLatestCredentials}
            >
              {latestCredsCopied ? (
                <Check size={15} strokeWidth={2.5} aria-hidden className="ct-member-action-btn__copied-icon" />
              ) : (
                <Copy size={15} strokeWidth={2} aria-hidden />
              )}
            </button>
          </div>
        </div>
      ) : null}

      <MemberDetailsPanel
        adminMemberTab={adminMemberTab}
        setAdminMemberTab={setAdminMemberTab}
        adminAnalystRows={adminAnalystRows}
        adminMainLeadRows={adminMainLeadRows}
        teamColorFor={teamColorFor}
        openMemberEditModal={openMemberEditModal}
        copyUserCredentials={copyUserCredentials}
        deleteUser={deleteUser}
        emailUpdatedId={emailUpdatedId}
        teamsUpdatedId={teamsUpdatedId}
        profilesUpdatedId={profilesUpdatedId}
        passwordUpdatedId={passwordUpdatedId}
        copiedUserId={copiedUserId}
        onAddUser={() => {
          setProfilePickerQuery("");
          setSidePicker(null);
          setAddUserModalOpen(true);
        }}
        onManageProfiles={() => setProfileCatalogOpen(true)}
        onManageTeams={() => setTeamCatalogOpen(true)}
      />

      {typeof document !== "undefined" && memberEditModal && activeMember
        ? createPortal(
            <div
              role="presentation"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 11980,
                background: "rgba(15, 23, 42, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget && !memberEditBusy) closeMemberEditModal();
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Edit member details"
                aria-busy={memberEditBusy || undefined}
                style={{
                  ...card({
                    padding: "20px 22px",
                    maxWidth: 560,
                    width: "100%",
                    maxHeight: "82vh",
                    overflowY: "auto",
                    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
                  }),
                  position: "relative",
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {memberEditBusy ? (
                  <div className="ct-dialog-busy-overlay" aria-hidden>
                    <span className="ct-dialog-busy-overlay__pill">
                      <BusyLabel label="Saving…" />
                    </span>
                  </div>
                ) : null}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                    {memberEditModal.kind === "email"
                      ? "Edit Login Email"
                      : memberEditModal.kind === "teams"
                        ? "Edit Teams"
                        : memberEditModal.kind === "profiles"
                          ? "Edit Profiles"
                          : "Change Password"}
                  </div>
                  <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>
                    {activeMember.name || activeMember.email || "Selected user"}
                  </div>
                </div>

                {memberEditModal.kind === "email" && (
                  <div style={{ display: "grid", gap: 10 }}>
                    <input
                      className="ct-input"
                      style={input()}
                      type="email"
                      placeholder="New login email"
                      value={emailDrafts[activeMember.id] || ""}
                      disabled={memberEditBusy}
                      onChange={(e) =>
                        setEmailDrafts((prev) => ({
                          ...prev,
                          [activeMember.id]: e.target.value,
                        }))
                      }
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button
                        type="button"
                        {...btn("ghost", { padding: "9px 15px" })}
                        onClick={closeMemberEditModal}
                        disabled={memberEditBusy}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        {...btn("primary", { padding: "9px 15px" })}
                        disabled={memberEditBusy}
                        aria-busy={memberEditBusy || undefined}
                        onClick={() => void runMemberEditSave(() => updateUserEmail(activeMember.id))}
                      >
                        {memberEditBusy ? <BusyLabel label="Saving…" /> : "Save Email"}
                      </button>
                    </div>
                  </div>
                )}

                {memberEditModal.kind === "password" && (
                  <div style={{ display: "grid", gap: 10 }}>
                    <input
                      className="ct-input"
                      style={input()}
                      type="password"
                      placeholder="New password (min 6 chars)"
                      value={passwordDrafts[activeMember.id] || ""}
                      disabled={memberEditBusy}
                      onChange={(e) =>
                        setPasswordDrafts((prev) => ({
                          ...prev,
                          [activeMember.id]: e.target.value,
                        }))
                      }
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button
                        type="button"
                        {...btn("ghost", { padding: "9px 15px" })}
                        onClick={closeMemberEditModal}
                        disabled={memberEditBusy}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        {...btn("primary", { padding: "9px 15px" })}
                        disabled={memberEditBusy}
                        aria-busy={memberEditBusy || undefined}
                        onClick={() =>
                          void runMemberEditSave(() => updateUserPassword(activeMember.id))
                        }
                      >
                        {memberEditBusy ? <BusyLabel label="Saving…" /> : "Save Password"}
                      </button>
                    </div>
                  </div>
                )}

                {memberEditModal.kind === "teams" && (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div
                      style={{
                        maxHeight: 240,
                        overflowY: "auto",
                        border: `1px solid ${C.border}`,
                        borderRadius: RAD.md,
                        background: C.card2,
                        padding: 10,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {teams.length === 0 ? (
                        <span style={{ color: C.muted, fontSize: 12 }}>
                          Add team names above before assigning.
                        </span>
                      ) : (
                        teams.map((team) => {
                          const picked = (memberTeamsDraft[activeMember.id] || []).includes(team);
                          const dot = teamColorFor(team);
                          return picked ? (
                            <DismissiblePillChip
                              key={`${activeMember.id}-${team}-on`}
                              label={team}
                              dotColor={dot}
                              dismissLabel={`Remove ${team}`}
                              onDismiss={() => toggleMemberTeamDraft(activeMember.id, team)}
                            />
                          ) : (
                            <OutlineTeamPickerChip
                              key={`${activeMember.id}-${team}-off`}
                              label={team}
                              dotColor={dot}
                              onAdd={() => toggleMemberTeamDraft(activeMember.id, team)}
                            />
                          );
                        })
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button
                        type="button"
                        {...btn("ghost", { padding: "9px 15px" })}
                        onClick={closeMemberEditModal}
                        disabled={memberEditBusy}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        {...btn("primary", { padding: "9px 15px" })}
                        disabled={memberEditBusy}
                        aria-busy={memberEditBusy || undefined}
                        onClick={() => void runMemberEditSave(() => saveMemberTeams(activeMember.id))}
                      >
                        {memberEditBusy ? <BusyLabel label="Saving…" /> : "Save Teams"}
                      </button>
                    </div>
                  </div>
                )}

                {memberEditModal.kind === "profiles" && (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div
                      style={{
                        maxHeight: 240,
                        overflowY: "auto",
                        border: `1px solid ${C.border}`,
                        borderRadius: RAD.md,
                        background: C.card2,
                        padding: 10,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {profiles.length === 0 ? (
                        <span style={{ color: C.muted, fontSize: 12 }}>
                          Add profile names above before assigning.
                        </span>
                      ) : (
                        profiles.map((name) => {
                          const picked = (memberProfilesDraft[activeMember.id] || []).includes(
                            name,
                          );
                          return picked ? (
                            <DismissiblePillChip
                              key={`${activeMember.id}-${name}-on`}
                              label={name}
                              dotColor={C.violet}
                              dismissLabel={`Remove ${name}`}
                              onDismiss={() => toggleMemberProfileDraft(activeMember.id, name)}
                            />
                          ) : (
                            <OutlineTeamPickerChip
                              key={`${activeMember.id}-${name}-off`}
                              label={name}
                              dotColor={C.violet}
                              onAdd={() => toggleMemberProfileDraft(activeMember.id, name)}
                            />
                          );
                        })
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                      <button
                        type="button"
                        {...btn("ghost", { padding: "9px 15px" })}
                        onClick={closeMemberEditModal}
                        disabled={memberEditBusy}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        {...btn("primary", { padding: "9px 15px" })}
                        disabled={memberEditBusy}
                        aria-busy={memberEditBusy || undefined}
                        onClick={() =>
                          void runMemberEditSave(() => saveMemberProfiles(activeMember.id))
                        }
                      >
                        {memberEditBusy ? <BusyLabel label="Saving…" /> : "Save Profiles"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}

      {typeof document !== "undefined" && addUserModalOpen
        ? createPortal(
            <div
              role="presentation"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 11900,
                background: "rgba(15, 23, 42, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget && !createUserBusy) closeAddUserModal();
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ct-admin-add-user-title"
                aria-busy={createUserBusy || undefined}
                style={{
                  ...card({
                    padding: "20px 22px",
                    maxWidth: 560,
                    width: "100%",
                    maxHeight: "85vh",
                    overflowY: "auto",
                    boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
                  }),
                  position: "relative",
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {createUserBusy ? (
                  <div className="ct-dialog-busy-overlay" aria-hidden>
                    <span className="ct-dialog-busy-overlay__pill">
                      <BusyLabel label="Creating user…" />
                    </span>
                  </div>
                ) : null}
                <div
                  id="ct-admin-add-user-title"
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 12,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Add User
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      color: C.label,
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 8,
                    }}
                  >
                    Select User Type
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {(
                      [
                        { id: "analyst" as const, label: "Chat Analyst", hint: "Handles chat logs and responses" },
                        {
                          id: "mainTeamLead" as const,
                          label: "Main Team Lead",
                          hint: "Manages lead-side note workflows",
                        },
                      ] as const
                    ).map((opt) => {
                      const selected = adminAddRole === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setAdminAddRole(opt.id);
                            if (opt.id === "mainTeamLead") {
                              setSidePicker((sp) => (sp === "profiles" ? null : sp));
                              setNewUserProfileNames([]);
                              setProfilePickerQuery("");
                            }
                          }}
                          style={card({
                            background: selected ? `${C.accent}12` : C.surface,
                            borderColor: selected ? `${C.accent}88` : C.border,
                            boxShadow: selected ? `0 0 0 2px ${C.accent}22` : "none",
                            borderRadius: RAD.lg,
                            padding: "12px 14px",
                            textAlign: "left",
                            cursor: "pointer",
                            transition: "all .15s ease",
                          })}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: C.text,
                              marginBottom: 4,
                            }}
                          >
                            {opt.label}
                          </div>
                          <div style={{ fontSize: 12, color: C.muted }}>{opt.hint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ color: C.label, fontSize: 12.5, marginBottom: 10 }}>
                  Enter {adminAddRole === "analyst" ? "Chat Analyst" : "Main Team Lead"} details
                </div>
                <div style={{ marginBottom: 10 }}>
                  <input
                    className="ct-input"
                    style={input()}
                    placeholder="Full name"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <input
                    className="ct-input"
                    style={input()}
                    placeholder="User login email"
                    type="email"
                    value={newAnalystEmail}
                    onChange={(e) => setNewAnalystEmail(e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <input
                    className="ct-input"
                    style={input()}
                    placeholder="Password (min 6 chars)"
                    type="password"
                    value={newAnalystPassword}
                    onChange={(e) => setNewAnalystPassword(e.target.value)}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      color: C.label,
                      fontSize: 12.5,
                      marginBottom: 8,
                      fontWeight: 600,
                    }}
                  >
                    Assign Team(s)
                  </div>
                  <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>
                    Choose one or more teams for this user.
                  </div>
                  <button
                    type="button"
                    onClick={() => teams.length > 0 && setSidePicker("teams")}
                    style={{
                      width: "100%",
                      background: C.surface,
                      border: `1px solid ${sidePicker === "teams" ? C.accent : C.border}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      color: teams.length > 0 ? C.text : C.muted,
                      cursor: teams.length > 0 ? "pointer" : "not-allowed",
                      fontSize: 13,
                    }}
                  >
                    <span>{selectedTeamSummary}</span>
                    <span style={{ color: C.label, fontSize: 12 }}>
                      {teams.length > 0 ? "Open picker →" : "No teams"}
                    </span>
                  </button>
                  <div
                    style={{
                      marginTop: 8,
                      minHeight: 38,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      overflowX: "auto",
                      flexWrap: "nowrap",
                      whiteSpace: "nowrap",
                      paddingBottom: 2,
                    }}
                  >
                    {newUserTeamNames.length > 0 ? (
                      newUserTeamNames.map((team) => (
                        <DismissiblePillChip
                          key={team}
                          label={team}
                          dotColor={teamColorFor(team)}
                          dismissLabel={`Remove ${team} from new user`}
                          onDismiss={() => toggleNewUserTeamName(team)}
                        />
                      ))
                    ) : (
                      <span style={{ color: C.muted, fontSize: 12 }}>No team selected yet.</span>
                    )}
                  </div>
                </div>
                {adminAddRole === "analyst" && (
                  <div style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        color: C.label,
                        fontSize: 12.5,
                        marginBottom: 8,
                        fontWeight: 600,
                      }}
                    >
                      Assign Profile(s)
                    </div>
                    <div style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>
                      Search by name — matches appear in the panel on the right. Click a row to add
                      or remove from this user.
                    </div>
                    <input
                      className="ct-input"
                      style={input()}
                      type="search"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label="Search profiles to assign"
                      placeholder={
                        profiles.length > 0
                          ? "Type to search profiles…"
                          : "Add profile names in the catalog first"
                      }
                      value={profilePickerQuery}
                      disabled={profiles.length === 0}
                      onChange={(e) => {
                        setProfilePickerQuery(e.target.value);
                        if (profiles.length > 0) setSidePicker("profiles");
                      }}
                      onFocus={() => profiles.length > 0 && setSidePicker("profiles")}
                    />
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 6, marginBottom: 4 }}>
                      {profiles.length === 0
                        ? "Add profiles in Profile Names above before assigning."
                        : profilePickerQuery.trim()
                          ? "Results update as you type."
                          : "Focus here and type to open search results on the right."}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        minHeight: 38,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        overflowX: "auto",
                        flexWrap: "nowrap",
                        whiteSpace: "nowrap",
                        paddingBottom: 2,
                      }}
                    >
                      {newUserProfileNames.length > 0 ? (
                        newUserProfileNames.map((profile) => (
                          <DismissiblePillChip
                            key={profile}
                            label={profile}
                            dotColor={C.violet}
                            dismissLabel={`Remove ${profile} from new user`}
                            onDismiss={() => toggleNewUserProfileName(profile)}
                          />
                        ))
                      ) : (
                        <span style={{ color: C.muted, fontSize: 12 }}>
                          No profile selected yet.
                        </span>
                      )}
                    </div>
                    {profiles.length === 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: C.muted }}>
                        Add a profile name first to select it while creating users.
                      </div>
                    )}
                  </div>
                )}
                {teams.length === 0 && (
                  <div style={{ marginBottom: 10, fontSize: 12, color: C.muted }}>
                    Add a team name first to select it while creating users.
                  </div>
                )}
                <div style={{ marginBottom: 12, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                  {adminAddRole === "analyst"
                    ? "Chat Analysts and Main Team Leads will only access data from the team(s) selected above."
                    : "Main team leads only access data from the team(s) selected above."}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    {...btn("ghost", { padding: "9px 16px" })}
                    onClick={closeAddUserModal}
                    disabled={createUserBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    {...btn("primary", { padding: "9px 16px" })}
                    disabled={createUserBusy}
                    aria-busy={createUserBusy || undefined}
                    onClick={async () => {
                      if (createUserBusy) return;
                      setCreateUserBusy(true);
                      try {
                        const ok = await createUser();
                        if (ok) closeAddUserModal();
                      } finally {
                        setCreateUserBusy(false);
                      }
                    }}
                  >
                    {createUserBusy ? <BusyLabel label="Creating…" /> : "Create User"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {typeof document !== "undefined" &&
      addUserModalOpen &&
      sidePicker &&
      !(adminAddRole === "mainTeamLead" && sidePicker === "profiles")
        ? createPortal(
            <div
              role="presentation"
              style={{
                position: "fixed",
                top: "50%",
                left: "min(calc(50% + 292px), calc(100vw - 440px))",
                transform: "translateY(-50%)",
                zIndex: 11950,
                width: sidePicker === "profiles" ? 420 : 360,
                maxWidth: "calc(100vw - 40px)",
              }}
            >
              <div
                role="dialog"
                aria-modal="false"
                aria-label={
                  sidePicker === "teams" ? "Team picker" : "Profile search results"
                }
                style={card({
                  padding: "16px 14px",
                  borderRadius: RAD.lg,
                  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.2)",
                  maxHeight: "78vh",
                  minHeight: sidePicker === "profiles" ? 280 : undefined,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                })}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                      {sidePicker === "teams" ? "Select Team(s)" : "Profile search results"}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {sidePicker === "teams"
                        ? `${newUserTeamNames.length} selected`
                        : `${newUserProfileNames.length} on this user`}
                    </div>
                  </div>
                  <button
                    type="button"
                    {...btn("ghost", { padding: "7px 10px", fontSize: 12 })}
                    onClick={() => setSidePicker(null)}
                  >
                    Close
                  </button>
                </div>
                {sidePicker === "profiles" ? (
                  <>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: C.muted,
                        lineHeight: 1.45,
                        padding: "0 2px",
                        flexShrink: 0,
                      }}
                    >
                      {!profilePickerQuery.trim() ? (
                        <span>Type in the search field on the left to find profiles.</span>
                      ) : profileAddUserSearchResults.total === 0 ? (
                        <span>No profiles match your search.</span>
                      ) : (
                        <span style={{ color: C.text }}>
                          <strong style={{ fontFamily: MONO }}>
                            {profileAddUserSearchResults.total}
                          </strong>{" "}
                          match{profileAddUserSearchResults.total === 1 ? "" : "es"}
                          {profileAddUserSearchResults.capped
                            ? ` — showing first ${profileAddUserSearchResults.rows.length}`
                            : ""}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        borderTop: `1px solid ${C.dim}`,
                        marginTop: 2,
                        paddingTop: 8,
                        flex: 1,
                        minHeight: 0,
                        overflowY: "auto",
                        WebkitOverflowScrolling: "touch",
                      }}
                    >
                      {profileAddUserSearchResults.rows.map((name) => {
                        const checked = newUserProfileNames.includes(name);
                        const accent = C.violet;
                        return (
                          <button
                            key={`profiles-search-${name}`}
                            type="button"
                            onClick={() => toggleNewUserProfileName(name)}
                            style={{
                              width: "100%",
                              background: checked ? `${accent}16` : "transparent",
                              border: `1px solid ${checked ? `${accent}66` : "transparent"}`,
                              borderRadius: 10,
                              padding: "9px 10px",
                              color: C.text,
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: 13,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 6,
                            }}
                          >
                            <span>{name}</span>
                            <span style={{ color: checked ? accent : C.border, fontWeight: 700 }}>
                              {checked ? "Selected" : "+"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      borderTop: `1px solid ${C.dim}`,
                      marginTop: 2,
                      paddingTop: 8,
                      overflowY: "auto",
                      flex: 1,
                      minHeight: 0,
                      WebkitOverflowScrolling: "touch",
                    }}
                  >
                    {teams.length === 0 ? (
                      <div style={{ color: C.muted, fontSize: 12, padding: "8px 4px" }}>
                        No teams available.
                      </div>
                    ) : (
                      teams.map((name) => {
                        const checked = newUserTeamNames.includes(name);
                        const accent = teamColorFor(name);
                        return (
                          <button
                            key={`teams-${name}`}
                            type="button"
                            onClick={() => toggleNewUserTeamName(name)}
                            style={{
                              width: "100%",
                              background: checked ? `${accent}16` : "transparent",
                              border: `1px solid ${checked ? `${accent}66` : "transparent"}`,
                              borderRadius: 10,
                              padding: "9px 10px",
                              color: C.text,
                              textAlign: "left",
                              cursor: "pointer",
                              fontSize: 13,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 6,
                            }}
                          >
                            <span>{name}</span>
                            <span style={{ color: checked ? accent : C.border, fontWeight: 700 }}>
                              {checked ? "Selected" : "+"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}

      {typeof document !== "undefined" && confirmModal
        ? createPortal(
            <div
              role="presentation"
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 12000,
                background: "rgba(15, 23, 42, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setConfirmModal(null);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ct-admin-confirm-title"
                style={card({
                  padding: "20px 22px",
                  maxWidth: 420,
                  width: "100%",
                  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
                })}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  id="ct-admin-confirm-title"
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 8,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {confirmModal.kind === "catalogTeam"
                    ? "Delete team from workspace?"
                    : "Remove team access?"}
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    color: C.label,
                    lineHeight: 1.5,
                    marginBottom: 18,
                  }}
                >
                  {confirmModal.kind === "catalogTeam" ? (
                    <>
                      Delete team{" "}
                      <span style={{ fontWeight: 600, color: C.text }}>
                        {confirmModal.teamName}
                      </span>
                      ? This will also delete all members assigned to that team and their associated
                      records, including chats logged under this team name.
                    </>
                  ) : (
                    <>
                      Remove{" "}
                      <span style={{ fontWeight: 600, color: C.text }}>
                        {confirmModal.teamName}
                      </span>{" "}
                      from{" "}
                      <span style={{ fontWeight: 600, color: C.text }}>
                        {confirmModal.memberLabel}
                      </span>
                      ? They will lose access to that team until you add it again under Edit teams.
                    </>
                  )}
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    {...btn("ghost", { padding: "9px 16px" })}
                    onClick={() => setConfirmModal(null)}
                    disabled={confirmBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    {...btn("danger", { padding: "9px 16px" })}
                    disabled={confirmBusy}
                    aria-busy={confirmBusy || undefined}
                    onClick={() => {
                      void (async () => {
                        if (confirmBusy) return;
                        setConfirmBusy(true);
                        try {
                          if (confirmModal.kind === "catalogTeam") {
                            const ok = await removeTeamName(confirmModal.teamName);
                            setConfirmModal(null);
                            if (ok) closeTeamCatalog();
                          } else {
                            removeMemberTeam(confirmModal.userId, confirmModal.teamName);
                            setConfirmModal(null);
                          }
                        } finally {
                          setConfirmBusy(false);
                        }
                      })();
                    }}
                  >
                    {confirmBusy ? (
                      <BusyLabel label="Deleting…" />
                    ) : confirmModal.kind === "catalogTeam" ? (
                      "Yes, delete team"
                    ) : (
                      "Yes, remove access"
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
