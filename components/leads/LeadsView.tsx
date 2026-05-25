"use client";

import { useMemo } from "react";
import NotesTabsPanel from "@/components/notes/NotesTabsPanel";
import AvatarMark from "@/components/ui/AvatarMark";
import { LeadsPageSkeleton } from "@/components/ui/WorkspaceSkeletons";
import { filterRecordsForViewer, getUserTeamsList } from "@/lib/auth/scoping";
import { teamColorFor } from "@/lib/design/colors";
import { C } from "@/lib/design/tokens";
import {
  buildTeamLeadUsers,
  filterAnalystNotesRows,
  filterMainLeadNotesRows,
} from "@/lib/notes/helpers";
import { dicebearSeedForUser } from "@/lib/utils/dicebear";
import { makeDisplayName } from "@/lib/utils/display-name";
import { initialsForPeek } from "@/lib/utils/user-display";
import type { ChatRecord } from "@/lib/db/records";
import type { WorkspaceUser } from "@/lib/workspace/cache";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useFilteredRecords } from "@/hooks/useFilteredRecords";
import { useWorkspaceHydration } from "@/hooks/useWorkspaceHydration";
import { useGlobalFiltersStore } from "@/store/global-filters-store";

function RosterTeamPill({ team }: { team: string }) {
  const label = team || "—";
  const tint = teamColorFor(team);
  return (
    <span
      className="ct-notes-team-pill"
      style={{
        borderColor: `${tint}44`,
        background: `linear-gradient(165deg, ${tint}22 0%, ${tint}0d 100%)`,
        color: tint,
      }}
    >
      <span className="ct-notes-team-pill__dot" style={{ background: tint }} aria-hidden />
      {label}
    </span>
  );
}

function LeadsRosterTable({ teamLeadUsers }: { teamLeadUsers: WorkspaceUser[] }) {
  return (
    <section className="ct-card ct-leads-roster-card">
      <div className="ct-leads-roster__head">
        <h2 className="ct-section-title ct-leads-roster__title">Team Leads</h2>
        <span className="ct-leads-roster__count">{teamLeadUsers.length}</span>
      </div>
      <div className="ct-notes-table-scroll ct-leads-roster-scroll">
        <table className="ct-leads-roster-table">
          <colgroup>
            <col className="ct-leads-col ct-leads-col--id" />
            <col className="ct-leads-col ct-leads-col--name" />
            <col className="ct-leads-col ct-leads-col--email" />
            <col className="ct-leads-col ct-leads-col--role" />
            <col className="ct-leads-col ct-leads-col--team" />
          </colgroup>
          <thead>
            <tr>
              <th>Lead ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Team</th>
            </tr>
          </thead>
          <tbody>
            {teamLeadUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="ct-leads-roster__empty">
                  No team leads associated with this team yet.
                </td>
              </tr>
            ) : (
              teamLeadUsers.map((u) => {
                const displayName = makeDisplayName(u);
                const teams = getUserTeamsList(u);
                return (
                  <tr key={u.id}>
                    <td className="ct-leads-roster__id">{String(u.id)}</td>
                    <td className="ct-leads-roster__name">
                      <div className="ct-lead-name-row">
                        <AvatarMark
                          tint={teamColorFor(teams[0] || "")}
                          initials={initialsForPeek(displayName || "—")}
                          avatarSeed={dicebearSeedForUser(u)}
                          size={26}
                        />
                        <span className="ct-lead-name">{displayName || "—"}</span>
                      </div>
                    </td>
                    <td className="ct-leads-roster__email">{u.email}</td>
                    <td className="ct-leads-roster__role">
                      <span
                        className="ct-leads-roster__role-pill"
                        style={{ background: `${C.violet}14`, color: C.violet }}
                      >
                        Chat Analyst Team Lead
                      </span>
                    </td>
                    <td className="ct-leads-roster__teams">
                      {teams.length ? (
                        <div className="ct-leads-roster__team-list">
                          {teams.map((t) => (
                            <RosterTeamPill key={t} team={t} />
                          ))}
                        </div>
                      ) : (
                        <span className="ct-notes-table__muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function LeadsView() {
  const user = useAuthStore((s) => s.user);
  const records = useWorkspaceStore((s) => s.records);
  const users = useWorkspaceStore((s) => s.users);
  const profileFilter = useGlobalFiltersStore((s) => s.filters.fProfile);
  const { showSkeleton } = useWorkspaceHydration();

  const visibleRecords = useMemo(
    () => filterRecordsForViewer(user!, records) as ChatRecord[],
    [user, records],
  );

  const filteredRecords = useFilteredRecords(visibleRecords);

  const teamLeadUsers = useMemo(
    () => (user ? buildTeamLeadUsers(users, user) : []),
    [users, user],
  );

  const analystNotesRows = useMemo(
    () => filterAnalystNotesRows(filteredRecords, ""),
    [filteredRecords],
  );

  const mainLeadNotesRows = useMemo(
    () => filterMainLeadNotesRows(filteredRecords, ""),
    [filteredRecords],
  );

  if (!user || user.role !== "mainTeamLead") return null;

  if (showSkeleton) {
    return <LeadsPageSkeleton />;
  }

  return (
    <div className="ct-leads-page">
      <LeadsRosterTable teamLeadUsers={teamLeadUsers} />
      <NotesTabsPanel
        analystRows={analystNotesRows}
        mainLeadRows={mainLeadNotesRows}
        users={users}
        analystEmptyMessage="No analyst notes added yet."
        paginationNavLabel="Chat Analyst Notes pagination (all leads)"
        profileFilterKey={profileFilter}
      />
    </div>
  );
}
