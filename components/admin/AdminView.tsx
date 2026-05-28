"use client";

import { useCallback, useMemo, useState } from "react";
import { useWorkspaceHydration } from "@/hooks/useWorkspaceHydration";
import AdminSection from "./AdminSection";
import { AdminPanelSkeleton } from "@/components/ui/WorkspaceSkeletons";
import {
  buildAdminAnalystRows,
  buildAdminMainLeadRows,
  formatUserCredentialsText,
  memberProfiles,
  memberTeams,
} from "@/lib/admin/helpers";
import {
  addProfile,
  addTeam,
  createUser as createUserApi,
  deleteProfile,
  deleteTeam,
  deleteUser as deleteUserApi,
  patchUser,
} from "@/lib/api/mutations";
import { getUserTeamsList } from "@/lib/auth/scoping";
import { teamLeadMayManageMember } from "@/lib/auth/scoping-users";
import { teamColorFor } from "@/lib/design/colors";
import { C } from "@/lib/design/tokens";
import { normEmail } from "@/lib/db/users";
import { copyTextToClipboardFromClick } from "@/lib/utils/copy-to-clipboard";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { WorkspaceUser } from "@/lib/workspace/cache";

type AddRole = "analyst" | "mainTeamLead";

type LatestCreds = {
  role: AddRole;
  name: string;
  email: string;
  password: string;
  teamName: string;
  teamNames: string[];
  profileNames: string[];
};

function flash(setter: (v: boolean) => void) {
  setter(true);
  window.setTimeout(() => setter(false), 2000);
}

export default function AdminView() {
  const currentUser = useAuthStore((s) => s.user);
  const users = useWorkspaceStore((s) => s.users);
  const teams = useWorkspaceStore((s) => s.teams);
  const profiles = useWorkspaceStore((s) => s.profiles);
  const records = useWorkspaceStore((s) => s.records);
  const { showSkeleton } = useWorkspaceHydration();

  const teamLeadRestricted =
    currentUser?.role === "teamLead" && !currentUser?.isAdmin;

  const teamLeadManagesUser = useCallback(
    (u: WorkspaceUser) => {
      if (!(currentUser?.role === "teamLead" && u && u.role !== "teamLead")) return false;
      if (!teamLeadRestricted) return true;
      return teamLeadMayManageMember(currentUser, u, records);
    },
    [currentUser, teamLeadRestricted, records],
  );

  const [adminAddRole, setAdminAddRole] = useState<AddRole>("analyst");
  const [newUserName, setNewUserName] = useState("");
  const [newAnalystEmail, setNewAnalystEmail] = useState("");
  const [newAnalystPassword, setNewAnalystPassword] = useState("");
  const [newUserTeamNames, setNewUserTeamNames] = useState<string[]>([]);
  const [newUserProfileNames, setNewUserProfileNames] = useState<string[]>([]);
  const [userSaved, setUserSaved] = useState(false);
  const [userError, setUserError] = useState("");
  const [latestCreds, setLatestCreds] = useState<LatestCreds | null>(null);

  const [newTeamName, setNewTeamName] = useState("");
  const [teamSaved, setTeamSaved] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  const [adminMemberTab, setAdminMemberTab] = useState<"analyst" | "mainTeamLead">("analyst");
  const [emailDrafts, setEmailDrafts] = useState<Record<string | number, string>>({});
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string | number, string>>({});
  const [emailUpdatedId, setEmailUpdatedId] = useState<string | number | null>(null);
  const [passwordUpdatedId, setPasswordUpdatedId] = useState<string | number | null>(null);
  const [copiedUserId, setCopiedUserId] = useState<string | number | null>(null);
  const [latestCredsCopied, setLatestCredsCopied] = useState(false);

  const [editingMemberTeamsId, setEditingMemberTeamsId] = useState<string | number | null>(null);
  const [memberTeamsDraft, setMemberTeamsDraft] = useState<Record<string | number, string[]>>({});
  const [teamsUpdatedId, setTeamsUpdatedId] = useState<string | number | null>(null);

  const [editingMemberProfilesId, setEditingMemberProfilesId] = useState<string | number | null>(
    null,
  );
  const [memberProfilesDraft, setMemberProfilesDraft] = useState<
    Record<string | number, string[]>
  >({});
  const [profilesUpdatedId, setProfilesUpdatedId] = useState<string | number | null>(null);

  const adminAnalystRows = useMemo(
    () =>
      currentUser
        ? buildAdminAnalystRows(currentUser, users, records, teamLeadRestricted)
        : [],
    [currentUser, users, records, teamLeadRestricted],
  );

  const adminMainLeadRows = useMemo(
    () =>
      currentUser ? buildAdminMainLeadRows(currentUser, users, teamLeadRestricted) : [],
    [currentUser, users, teamLeadRestricted],
  );

  const toggleNewUserTeamName = (team: string) => {
    setNewUserTeamNames((prev) => {
      const idx = prev.indexOf(team);
      if (idx >= 0) return prev.filter((t) => t !== team);
      return [...prev, team];
    });
  };

  const toggleNewUserProfileName = (profile: string) => {
    setNewUserProfileNames((prev) => {
      const idx = prev.indexOf(profile);
      if (idx >= 0) return prev.filter((p) => p !== profile);
      return [...prev, profile];
    });
  };

  const createUser = async (): Promise<boolean> => {
    const name = newUserName.trim();
    const email = newAnalystEmail.trim().toLowerCase();
    const password = newAnalystPassword.trim();
    const teamNames = [...new Set(newUserTeamNames.map((t) => t.trim()).filter(Boolean))];
    const profileNames =
      adminAddRole === "mainTeamLead"
        ? []
        : [...new Set(newUserProfileNames.map((t) => t.trim()).filter(Boolean))];
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!name || !validEmail || password.length < 6 || !teamNames.length) {
      setUserError("Name, email, password (min 6), and at least one team are required.");
      return false;
    }
    if (users.some((u) => normEmail(u.email) === email)) {
      setUserError("User with this email already exists.");
      return false;
    }

    if (teamLeadRestricted && currentUser) {
      const allowed = new Set(getUserTeamsList(currentUser).map((t) => t.toLowerCase()));
      const outbound = teamNames.some((t) => !allowed.has(t.trim().toLowerCase()));
      if (outbound) {
        setUserError("You can only assign teams that you belong to.");
        return false;
      }
    }

    const userPayload = {
      role: adminAddRole,
      name,
      email,
      password,
      teamName: teamNames[0],
      teamNames,
      profileNames,
    };

    try {
      for (const t of teamNames.filter(
        (team) => !teams.some((x) => x.toLowerCase() === team.toLowerCase()),
      )) {
        await addTeam(t);
      }
      for (const p of profileNames.filter(
        (name) => !profiles.some((x) => x.toLowerCase() === name.toLowerCase()),
      )) {
        await addProfile(p);
      }
      await createUserApi(userPayload, adminAddRole);
    } catch (e) {
      setUserError(e instanceof Error ? e.message : "Could not save user.");
      return false;
    }

    setLatestCreds({
      name,
      email,
      password,
      teamName: teamNames[0],
      teamNames,
      profileNames,
      role: adminAddRole,
    });
    setLatestCredsCopied(false);
    setNewUserName("");
    setNewAnalystEmail("");
    setNewAnalystPassword("");
    setNewUserTeamNames([]);
    setNewUserProfileNames([]);
    setUserError("");
    flash(setUserSaved);
    return true;
  };

  const addTeamName = async (): Promise<boolean> => {
    const teamName = newTeamName.trim();
    if (!teamName) return false;
    if (teams.some((t) => t.toLowerCase() === teamName.toLowerCase())) return false;
    try {
      await addTeam(teamName);
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      window.alert(
        code === "TEAM_NAME_CONFLICT_CASE"
          ? `A team named "${teamName}" already exists with different capitalization. Use the existing name or remove it first.`
          : e instanceof Error
            ? e.message
            : "Could not save team.",
      );
      return false;
    }
    setNewTeamName("");
    flash(setTeamSaved);
    return true;
  };

  const addProfileName = async (): Promise<boolean> => {
    const profileName = newProfileName.trim();
    if (!profileName) return false;
    if (profiles.some((p) => p.toLowerCase() === profileName.toLowerCase())) return false;
    try {
      await addProfile(profileName);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not save profile.");
      return false;
    }
    setNewProfileName("");
    flash(setProfileSaved);
    return true;
  };

  const removeTeamName = async (teamName: string): Promise<boolean> => {
    if (currentUser?.role !== "teamLead") return false;
    const trimmed = (teamName || "").trim();
    if (!trimmed) return false;
    if (!teams.includes(trimmed)) return false;
    if (teamLeadRestricted && currentUser) {
      const leadTeams = new Set(getUserTeamsList(currentUser).map((t) => t.toLowerCase()));
      if (!leadTeams.has(trimmed.toLowerCase())) return false;
    }
    try {
      await deleteTeam(trimmed);
      flash(setTeamSaved);
      return true;
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not remove team.");
      return false;
    }
  };

  const removeProfileName = async (profileNameRaw: string): Promise<boolean> => {
    if (currentUser?.role !== "teamLead") return false;
    const target = (profileNameRaw || "").trim().toLowerCase();
    if (!target) return false;
    const canonical =
      profiles.find((p) => p.trim().toLowerCase() === target) || profileNameRaw.trim();
    try {
      await deleteProfile(canonical);
      flash(setProfileSaved);
      return true;
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not remove profile.");
      return false;
    }
  };

  const updateUserPassword = async (userId: string | number): Promise<boolean> => {
    const target = users.find((u) => String(u.id) === String(userId));
    if (!target || !teamLeadManagesUser(target)) return false;
    const nextPassword = (passwordDrafts[userId] || "").trim();
    if (nextPassword.length < 6) return false;
    try {
      await patchUser(userId, { ...target, password: nextPassword });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not update password.");
      return false;
    }
    setLatestCreds(null);
    setPasswordUpdatedId(userId);
    setPasswordDrafts((prev) => ({ ...prev, [userId]: "" }));
    window.setTimeout(() => setPasswordUpdatedId(null), 2000);
    return true;
  };

  const updateUserEmail = async (userId: string | number): Promise<boolean> => {
    const target = users.find((u) => String(u.id) === String(userId));
    if (!target || !teamLeadManagesUser(target)) return false;
    const nextEmail = (emailDrafts[userId] || "").trim().toLowerCase();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail);
    if (!validEmail) return false;
    if (users.some((u) => String(u.id) !== String(userId) && normEmail(u.email) === nextEmail)) {
      return false;
    }
    try {
      await patchUser(userId, { ...target, email: nextEmail });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not update email.");
      return false;
    }
    setLatestCreds(null);
    setEmailUpdatedId(userId);
    setEmailDrafts((prev) => ({ ...prev, [userId]: "" }));
    window.setTimeout(() => setEmailUpdatedId(null), 2000);
    return true;
  };

  const handleDeleteUser = async (userId: string | number) => {
    const target = users.find((u) => String(u.id) === String(userId));
    if (!target || !teamLeadManagesUser(target)) return;
    const ok = window.confirm(
      `Remove user ${target.name || target.email}? They will no longer be able to sign in.`,
    );
    if (!ok) return;
    try {
      await deleteUserApi(userId);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not delete user.");
      return;
    }
    setPasswordDrafts((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setEmailDrafts((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    if (editingMemberTeamsId === userId) setEditingMemberTeamsId(null);
    setMemberTeamsDraft((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const flashCopiedUser = (userId: string | number) => {
    setCopiedUserId(userId);
    window.setTimeout(() => {
      setCopiedUserId((cur) => (cur != null && String(cur) === String(userId) ? null : cur));
    }, 1800);
  };

  const copyLatestCredentials = () => {
    if (!latestCreds) return;
    const text = formatUserCredentialsText(latestCreds);
    setLatestCredsCopied(true);
    window.setTimeout(() => setLatestCredsCopied(false), 1800);

    void copyTextToClipboardFromClick(text).then((ok) => {
      if (!ok) {
        setLatestCredsCopied(false);
        window.alert(
          "Could not copy to clipboard. Select and copy the credentials shown above manually.",
        );
      }
    });
  };

  const copyUserCredentials = (user: WorkspaceUser) => {
    if (!user) return;
    const text = formatUserCredentialsText(user);
    flashCopiedUser(user.id);

    void copyTextToClipboardFromClick(text).then((ok) => {
      if (!ok) {
        setCopiedUserId((cur) =>
          cur != null && String(cur) === String(user.id) ? null : cur,
        );
        window.alert(
          "Could not copy to clipboard. Check browser permissions or copy the member details manually.",
        );
      }
    });
  };

  const beginEditMemberTeams = (userId: string | number) => {
    const u = users.find((x) => String(x.id) === String(userId));
    if (!u || !teamLeadManagesUser(u)) return;
    setEditingMemberTeamsId(userId);
    setMemberTeamsDraft((prev) => ({ ...prev, [userId]: [...memberTeams(u)] }));
  };

  const cancelMemberTeamsEdit = () => {
    setEditingMemberTeamsId(null);
  };

  const toggleMemberTeamDraft = (userId: string | number, teamName: string) => {
    setMemberTeamsDraft((prev) => {
      const cur = [...(prev[userId] || [])];
      const idx = cur.indexOf(teamName);
      if (idx >= 0) cur.splice(idx, 1);
      else cur.push(teamName);
      return { ...prev, [userId]: cur };
    });
  };

  const removeMemberTeam = async (userId: string | number, teamNameRaw: string) => {
    const target = users.find((u) => String(u.id) === String(userId));
    if (!target || !teamLeadManagesUser(target)) return;
    const teamLc = (teamNameRaw || "").trim().toLowerCase();
    if (!teamLc) return;
    const current = memberTeams(target);
    const next = current.filter((t) => t.trim().toLowerCase() !== teamLc);
    if (next.length === current.length) return;
    try {
      await patchUser(userId, { ...target, teamName: next[0] || "", teamNames: next });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not update teams.");
      return;
    }
    setLatestCreds(null);
    if (editingMemberTeamsId === userId) {
      setMemberTeamsDraft((prev) => ({ ...prev, [userId]: next }));
    }
    setTeamsUpdatedId(userId);
    window.setTimeout(() => setTeamsUpdatedId(null), 2000);
  };

  const saveMemberTeams = async (userId: string | number): Promise<boolean> => {
    const target = users.find((u) => String(u.id) === String(userId));
    if (!target || !teamLeadManagesUser(target)) return false;
    const allowed = new Set(teams.map((t) => t.trim().toLowerCase()));
    const raw = memberTeamsDraft[userId] || [];
    const fromPicker = [
      ...new Set(raw.map((t) => t.trim()).filter((t) => allowed.has(t.toLowerCase()))),
    ];
    const preserved = memberTeams(target).filter(
      (t) => !allowed.has(t.trim().toLowerCase()),
    );
    const names = [...new Set([...fromPicker, ...preserved].map((t) => t.trim()).filter(Boolean))];
    const missingTeams = names.filter(
      (team) => !teams.some((t) => t.toLowerCase() === team.toLowerCase()),
    );
    try {
      for (const t of missingTeams) {
        await addTeam(t);
      }
      await patchUser(userId, { ...target, teamName: names[0] || "", teamNames: names });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not save team assignments.");
      return false;
    }
    setLatestCreds(null);
    setEditingMemberTeamsId(null);
    setMemberTeamsDraft((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setTeamsUpdatedId(userId);
    window.setTimeout(() => setTeamsUpdatedId(null), 2000);
    return true;
  };

  const beginEditMemberProfiles = (userId: string | number) => {
    const u = users.find((x) => String(x.id) === String(userId));
    if (!u || !teamLeadManagesUser(u)) return;
    setEditingMemberProfilesId(userId);
    setMemberProfilesDraft((prev) => ({ ...prev, [userId]: [...memberProfiles(u)] }));
  };

  const cancelMemberProfilesEdit = () => {
    setEditingMemberProfilesId(null);
  };

  const toggleMemberProfileDraft = (userId: string | number, profileName: string) => {
    setMemberProfilesDraft((prev) => {
      const cur = [...(prev[userId] || [])];
      const idx = cur.indexOf(profileName);
      if (idx >= 0) cur.splice(idx, 1);
      else cur.push(profileName);
      return { ...prev, [userId]: cur };
    });
  };

  const saveMemberProfiles = async (userId: string | number): Promise<boolean> => {
    const target = users.find((u) => String(u.id) === String(userId));
    if (!target || !teamLeadManagesUser(target)) return false;
    const allowed = new Set(profiles.map((name) => name.trim().toLowerCase()));
    const raw = memberProfilesDraft[userId] || [];
    const fromPicker = [
      ...new Set(
        raw.map((name) => name.trim()).filter((name) => allowed.has(name.toLowerCase())),
      ),
    ];
    const preserved = memberProfiles(target).filter(
      (name) => !allowed.has(name.trim().toLowerCase()),
    );
    const names = [
      ...new Set([...fromPicker, ...preserved].map((name) => name.trim()).filter(Boolean)),
    ];
    const missingProfiles = names.filter(
      (name) => !profiles.some((p) => p.toLowerCase() === name.toLowerCase()),
    );
    try {
      for (const name of missingProfiles) {
        await addProfile(name);
      }
      await patchUser(userId, { ...target, profileNames: names });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not save profile assignments.");
      return false;
    }
    setLatestCreds(null);
    setEditingMemberProfilesId(null);
    setMemberProfilesDraft((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    setProfilesUpdatedId(userId);
    window.setTimeout(() => setProfilesUpdatedId(null), 2000);
    return true;
  };

  if (!currentUser || currentUser.role !== "teamLead") {
    return (
      <div style={{ padding: 24, color: C.muted, fontSize: 13 }}>
        User &amp; Teams admin is available to Chat Analyst Team Leads only.
      </div>
    );
  }

  if (showSkeleton) {
    return <AdminPanelSkeleton />;
  }

  return (
    <AdminSection
      adminAddRole={adminAddRole}
      setAdminAddRole={setAdminAddRole}
      newUserName={newUserName}
      setNewUserName={setNewUserName}
      newAnalystEmail={newAnalystEmail}
      setNewAnalystEmail={setNewAnalystEmail}
      newAnalystPassword={newAnalystPassword}
      setNewAnalystPassword={setNewAnalystPassword}
      newUserTeamNames={newUserTeamNames}
      toggleNewUserTeamName={toggleNewUserTeamName}
      newUserProfileNames={newUserProfileNames}
      setNewUserProfileNames={setNewUserProfileNames}
      toggleNewUserProfileName={toggleNewUserProfileName}
      teams={teams}
      createUser={createUser}
      userSaved={userSaved}
      latestCreds={latestCreds}
      userError={userError}
      copyLatestCredentials={copyLatestCredentials}
      latestCredsCopied={latestCredsCopied}
      newTeamName={newTeamName}
      setNewTeamName={setNewTeamName}
      addTeamName={addTeamName}
      teamSaved={teamSaved}
      newProfileName={newProfileName}
      setNewProfileName={setNewProfileName}
      addProfileName={addProfileName}
      removeProfileName={removeProfileName}
      profileSaved={profileSaved}
      profiles={profiles}
      removeTeamName={removeTeamName}
      adminAnalystRows={adminAnalystRows}
      adminMainLeadRows={adminMainLeadRows}
      adminMemberTab={adminMemberTab}
      setAdminMemberTab={setAdminMemberTab}
      emailDrafts={emailDrafts}
      setEmailDrafts={setEmailDrafts}
      updateUserEmail={updateUserEmail}
      emailUpdatedId={emailUpdatedId}
      passwordDrafts={passwordDrafts}
      setPasswordDrafts={setPasswordDrafts}
      updateUserPassword={updateUserPassword}
      passwordUpdatedId={passwordUpdatedId}
      copyUserCredentials={copyUserCredentials}
      copiedUserId={copiedUserId}
      deleteUser={handleDeleteUser}
      teamColorFor={teamColorFor}
      memberTeamsDraft={memberTeamsDraft}
      teamsUpdatedId={teamsUpdatedId}
      beginEditMemberTeams={beginEditMemberTeams}
      cancelMemberTeamsEdit={cancelMemberTeamsEdit}
      toggleMemberTeamDraft={toggleMemberTeamDraft}
      saveMemberTeams={saveMemberTeams}
      removeMemberTeam={removeMemberTeam}
      memberProfilesDraft={memberProfilesDraft}
      profilesUpdatedId={profilesUpdatedId}
      beginEditMemberProfiles={beginEditMemberProfiles}
      cancelMemberProfilesEdit={cancelMemberProfilesEdit}
      toggleMemberProfileDraft={toggleMemberProfileDraft}
      saveMemberProfiles={saveMemberProfiles}
    />
  );
}
