"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C, MONO, SANS } from "@/lib/design/tokens";
import { analystColorFor, teamColorFor } from "@/lib/design/colors";
import { fmtMins } from "@/lib/utils/format-duration";
import type { DashboardStats } from "@/lib/dashboard/stats";

const ttStyle = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  fontSize: 12,
  fontFamily: SANS,
};

const durationTooltip = (value: unknown) => [fmtMins(Number(value ?? 0)), "Duration"];

export default function DashboardCharts({ stats }: { stats: DashboardStats }) {
  return (
    <>
      <div className="ct-chart-grid ct-chart-grid-wide">
        <div className="ct-card" style={{ padding: "20px 24px" }}>
          <div className="ct-section-title">Daily Chat Volume</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.dateData}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 11, fontFamily: MONO }} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
              <Tooltip contentStyle={ttStyle} />
              <Line
                type="monotone"
                dataKey="chats"
                stroke={C.accent}
                strokeWidth={2.5}
                dot={{ fill: C.accent, r: 3 }}
                name="Chats"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="ct-card" style={{ padding: "20px 24px" }}>
          <div className="ct-section-title">Chats by Team</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.teamData} layout="vertical">
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: C.muted, fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: C.label, fontSize: 11, fontFamily: SANS }}
                width={120}
              />
              <Tooltip contentStyle={ttStyle} />
              <Bar dataKey="chats" radius={[0, 6, 6, 0]} name="Chats">
                {stats.teamData.map((entry) => (
                  <Cell key={`team-bar-${entry.name}`} fill={teamColorFor(entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="ct-chart-grid">
        <div className="ct-card" style={{ padding: "20px 24px" }}>
          <div className="ct-section-title">Avg Reply Time by Analyst (h:mm:ss)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={stats.analystData.map((a) => ({
                name: a.name,
                avgReply: a.avgReply != null ? +a.avgReply.toFixed(2) : 0,
              }))}
            >
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} />
              <YAxis
                tick={{ fill: C.muted, fontSize: 11, fontFamily: MONO }}
                tickFormatter={(v) => fmtMins(v)}
                width={72}
              />
              <Tooltip contentStyle={ttStyle} formatter={durationTooltip} />
              <Bar dataKey="avgReply" radius={[4, 4, 0, 0]} name="Avg reply">
                {stats.analystData.map((entry) => (
                  <Cell key={`analyst-bar-${entry.name}`} fill={analystColorFor(entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="ct-card" style={{ padding: "20px 24px" }}>
          <div className="ct-section-title">Daily Avg Reply Time (h:mm:ss)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={stats.dateData}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 11, fontFamily: MONO }} />
              <YAxis
                tick={{ fill: C.muted, fontSize: 11, fontFamily: MONO }}
                tickFormatter={(v) => fmtMins(v)}
                width={72}
              />
              <Tooltip contentStyle={ttStyle} formatter={durationTooltip} />
              <Line
                type="monotone"
                dataKey="avgReply"
                stroke={C.orange}
                strokeWidth={2.5}
                dot={{ fill: C.orange, r: 3 }}
                name="Avg reply"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
