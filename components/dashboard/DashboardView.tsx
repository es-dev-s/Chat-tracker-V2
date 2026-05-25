"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import {
  BadgeCheck,
  CircleDot,
  Clock3,
  Inbox,
  MessageCircle,
  MessageSquareWarning,
  Percent,
  Send,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { C, MONO, TYPE } from "@/lib/design/tokens";
import { fmtMins } from "@/lib/utils/format-duration";
import { isLeadNoteOnlyRecord } from "@/lib/dashboard/records";
import { computeDashboardStats } from "@/lib/dashboard/stats";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useFilteredRecords } from "@/hooks/useFilteredRecords";
import { useWorkspaceHydration } from "@/hooks/useWorkspaceHydration";
import { DashboardSkeleton } from "@/components/ui/WorkspaceSkeletons";
import DashboardKpiBoard, {
  type DashboardKpiItem,
} from "@/components/dashboard/DashboardKpiSections";

const DashboardCharts = dynamic(() => import("./DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="ct-card ct-chart-skeleton" style={{ padding: "20px 24px", minHeight: 220 }} />
  ),
});

type KpiItem = DashboardKpiItem;

export default function DashboardView() {
  const user = useAuthStore((s) => s.user);
  const records = useWorkspaceStore((s) => s.records);
  const { showSkeleton } = useWorkspaceHydration();

  const role = user?.role ?? "analyst";

  const recordsForMetrics = useMemo(
    () => records.filter((r) => !isLeadNoteOnlyRecord(r)),
    [records],
  );

  const filtered = useFilteredRecords(recordsForMetrics);

  const stats = useMemo(() => computeDashboardStats(filtered), [filtered]);

  const dashboardEmptyCopy = useMemo(() => {
    if (role === "mainTeamLead") {
      return "No chat records appear in your team scope yet. Metrics will populate automatically as analysts log conversations on these teams.";
    }
    if (role === "teamLead") {
      return "Nothing matches the current dashboard filters yet. When analysts capture chats across your permitted teams, KPIs summarize here.";
    }
    return "No chats match these filters yet. Log a conversation, then revisit this dashboard to see live KPIs.";
  }, [role]);

  const kpiCards = useMemo<KpiItem[]>(
    () => [
      {
        label: "Total Chats Received",
        value: stats.totR.toLocaleString(),
        sub: `${filtered.length.toLocaleString()} logs in scope`,
        tone: "blue",
        icon: Inbox,
      },
      {
        label: "Total Chat Attempted",
        value: stats.totA.toLocaleString(),
        sub: "First reply logged",
        tone: "cyan",
        icon: Send,
      },
      {
        label: "Total Chat Resolved",
        value: stats.totRs.toLocaleString(),
        sub: "Marked resolved",
        tone: "green",
        icon: BadgeCheck,
      },
      {
        label: "Attempted %",
        value: `${stats.attemptedPct}%`,
        sub: `${stats.totA.toLocaleString()} of ${stats.totR.toLocaleString()}`,
        tone: "cyan",
        icon: Percent,
      },
      {
        label: "Resolved %",
        value: `${stats.resolvedPct}%`,
        sub: `${stats.totRs.toLocaleString()} of ${stats.totR.toLocaleString()}`,
        tone: "green",
        icon: BadgeCheck,
      },
      {
        label: "Top Analyst",
        value: stats.topAnalyst ? stats.topAnalyst.name : "—",
        sub: stats.topAnalyst
          ? `${stats.topAnalyst.chats.toLocaleString()} chats`
          : "No analyst data",
        tone: "blue",
        valueType: "text",
        icon: Trophy,
      },
      {
        label: "Awaiting first reply",
        value: stats.awaitingFirstReply.toLocaleString(),
        sub: "Receive logged · reply empty",
        tone: "rose",
        variant: "alert",
        icon: MessageSquareWarning,
      },
      {
        label: "Open (no close time)",
        value: stats.openNoClose.toLocaleString(),
        sub: "Reply logged · close empty",
        tone: "amber",
        variant: "alert",
        icon: CircleDot,
      },
      {
        label: "Total Reply Minute Difference",
        value: fmtMins(stats.totalReplyDiff),
        sub: "First-response lag total",
        tone: "violet",
        icon: Clock3,
      },
      {
        label: "Total Conversation",
        value: fmtMins(stats.totalConvDuration),
        sub: "Combined duration",
        tone: "amber",
        icon: Timer,
      },
      {
        label: "Avg Time Response",
        value: fmtMins(stats.avgReply),
        sub: "First response · h:mm:ss",
        tone: "violet",
        icon: Zap,
      },
      {
        label: "Avg Conversation Time",
        value: fmtMins(stats.avgConv),
        sub: "Full conversation · h:mm:ss",
        tone: "amber",
        icon: MessageCircle,
      },
    ],
    [stats, filtered.length],
  );

  if (!user) return null;

  return (
    <div>
      {showSkeleton ? (
        <DashboardSkeleton />
      ) : (
        <>
      {recordsForMetrics.length === 0 ? (
        <div className="ct-card ct-dash-empty">
          <div className="ct-dash-empty-icon" aria-hidden />
          <div style={{ ...TYPE.bodySm, color: C.text, marginBottom: 8, fontWeight: 600 }}>
            No dashboard metrics yet
          </div>
          <div style={{ ...TYPE.caption, color: C.muted, lineHeight: 1.55 }}>{dashboardEmptyCopy}</div>
        </div>
      ) : (
        <div className="ct-dash-stack">
          <DashboardKpiBoard items={kpiCards} />

          <DashboardCharts stats={stats} />

          <div className="ct-perf-grid">
            <div className="ct-card ct-perf-card">
              <div className="ct-section-title">Analyst Performance</div>
              <div className="ct-perf-table-scroll">
                <table className="ct-data-grid ct-perf-table">
                  <thead>
                    <tr>
                      <th>Analyst</th>
                      <th style={{ textAlign: "right" }}>Chats</th>
                      <th style={{ textAlign: "right" }}>Avg reply</th>
                      <th style={{ textAlign: "right" }}>Avg conv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.analystData.map((a) => (
                      <tr key={a.name}>
                        <td>{a.name}</td>
                        <td style={{ textAlign: "right" }}>{a.chats}</td>
                        <td style={{ textAlign: "right", fontFamily: MONO }}>{fmtMins(a.avgReply)}</td>
                        <td style={{ textAlign: "right", fontFamily: MONO }}>{fmtMins(a.avgConv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="ct-card ct-perf-card">
              <div className="ct-section-title">Team Performance</div>
              <div className="ct-perf-table-scroll">
                <table className="ct-data-grid ct-perf-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th style={{ textAlign: "right" }}>Chats</th>
                      <th style={{ textAlign: "right" }}>Avg 1st Reply</th>
                      <th style={{ textAlign: "right" }}>Avg conv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.teamData.map((t) => (
                      <tr key={t.name}>
                        <td>
                          <span
                            className="ct-team-badge"
                            style={{ background: `${C.accent}14`, color: C.accent }}
                          >
                            {t.name}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>{t.chats}</td>
                        <td style={{ textAlign: "right", fontFamily: MONO }}>{fmtMins(t.avgReply)}</td>
                        <td style={{ textAlign: "right", fontFamily: MONO }}>{fmtMins(t.avgConv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
