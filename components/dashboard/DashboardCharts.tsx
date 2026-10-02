"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type TeamPoint = DashboardStats["teamData"][number];

function chatAxisTicks(maxValue: number): number[] {
  const max = Math.max(1, Math.ceil(maxValue));
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
  const step = steps.find((candidate) => max / candidate <= 4) ?? Math.ceil(max / 4);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return ticks;
}

function ChatsByTeamChart({ teams }: { teams: TeamPoint[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeName, setActiveName] = useState<string | null>(null);
  const [canScroll, setCanScroll] = useState(false);

  const ticks = useMemo(
    () => chatAxisTicks(Math.max(0, ...teams.map((team) => team.chats))),
    [teams],
  );
  const axisTop = ticks[ticks.length - 1] || 1;
  const active = teams.find((team) => team.name === activeName) ?? null;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setCanScroll(el.scrollWidth > el.clientWidth + 4);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [teams]);

  function revealTeam(index: number) {
    const scroller = scrollRef.current;
    const column = scroller?.querySelector<HTMLElement>(`[data-team-index="${index}"]`);
    if (!scroller || !column) return;
    const start = column.offsetLeft;
    const end = start + column.offsetWidth;
    const viewStart = scroller.scrollLeft;
    const viewEnd = viewStart + scroller.clientWidth;
    if (start >= viewStart + 8 && end <= viewEnd - 8) return;
    const left = start - scroller.clientWidth / 2 + column.offsetWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }

  if (!teams.length) {
    return <p className="ct-team-chart__empty">No team chats in this view.</p>;
  }

  return (
    <div className={`ct-team-chart${active ? " is-active" : ""}`}>
      <div className="ct-team-chart__hover" aria-live="polite">
        {active ? (
          <>
            <span
              className="ct-team-chart__swatch"
              style={{ background: teamColorFor(active.name) }}
            />
            <span className="ct-team-chart__hover-name">{active.name}</span>
            <span className="ct-team-chart__hover-count">
              {active.chats.toLocaleString()} chats
            </span>
          </>
        ) : (
          <span>
            {canScroll
              ? "Scroll horizontally to compare every team."
              : "Hover a bar to see the team and chat count."}
          </span>
        )}
      </div>

      <div className="ct-team-chart__plot">
        <div className="ct-team-chart__y">
          <span className="ct-team-chart__axis-label">Chats</span>
          <div className="ct-team-chart__ticks" aria-hidden="true">
            {[...ticks].reverse().map((tick) => (
              <span key={tick}>{tick.toLocaleString()}</span>
            ))}
          </div>
          <span className="ct-team-chart__axis-spacer">Team</span>
        </div>
        <div
          ref={scrollRef}
          className="ct-team-chart__scroll"
          tabIndex={0}
          aria-label="Chats by team. Scroll horizontally to see every team."
        >
          <div className="ct-team-chart__columns">
            <div className="ct-team-chart__grid" aria-hidden="true">
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className="ct-team-chart__gridline"
                  style={{ bottom: `${(tick / axisTop) * 100}%` }}
                />
              ))}
            </div>
            {teams.map((team, index) => {
              const height = Math.max(team.chats > 0 ? 2 : 0, (team.chats / axisTop) * 100);
              const selected = activeName === team.name;
              return (
                <button
                  key={team.name}
                  type="button"
                  data-team-index={index}
                  className={`ct-team-chart__col${selected ? " is-active" : ""}`}
                  aria-label={`${team.name}, ${team.chats.toLocaleString()} chats`}
                  aria-pressed={selected}
                  onMouseEnter={() => setActiveName(team.name)}
                  onMouseLeave={() => setActiveName(null)}
                  onFocus={() => {
                    setActiveName(team.name);
                    revealTeam(index);
                  }}
                  onBlur={() => setActiveName(null)}
                >
                  <span className="ct-team-chart__track">
                    <span
                      className="ct-team-chart__bar"
                      style={{
                        height: `${height}%`,
                        background: teamColorFor(team.name),
                      }}
                    >
                      <span className="ct-team-chart__value">{team.chats.toLocaleString()}</span>
                    </span>
                  </span>
                  <span className="ct-team-chart__name">{team.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

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
          <ChatsByTeamChart teams={stats.teamData} />
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
