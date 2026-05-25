import type { ChatRecord } from "@/lib/db/records";
import { replyDiffFromRecord, totalConvFromRecord } from "@/lib/utils/format-duration";
import { sumChatOutcomeField } from "./records";

export type DashboardStats = {
  n: number;
  totR: number;
  totA: number;
  totRs: number;
  attemptedPct: string;
  resolvedPct: string;
  totalReplyDiff: number | null;
  totalConvDuration: number | null;
  avgReply: number | null;
  avgConv: number | null;
  topAnalyst: { name: string; chats: number } | null;
  analystData: Array<{
    name: string;
    chats: number;
    avgReply: number | null;
    avgConv: number | null;
  }>;
  teamData: Array<{
    name: string;
    chats: number;
    avgReply: number | null;
    avgConv: number | null;
  }>;
  dateData: Array<{ date: string; chats: number; avgReply: number }>;
  awaitingFirstReply: number;
  openNoClose: number;
};

const EMPTY: DashboardStats = {
  n: 0,
  totR: 0,
  totA: 0,
  totRs: 0,
  attemptedPct: "0.00",
  resolvedPct: "0.00",
  totalReplyDiff: null,
  totalConvDuration: null,
  avgReply: null,
  avgConv: null,
  topAnalyst: null,
  analystData: [],
  teamData: [],
  dateData: [],
  awaitingFirstReply: 0,
  openNoClose: 0,
};

export function computeDashboardStats(filtered: ChatRecord[]): DashboardStats {
  if (!filtered.length) return EMPTY;

  const totR = filtered.reduce((s, r) => s + sumChatOutcomeField(r, "received"), 0);
  const totA = filtered.reduce((s, r) => s + sumChatOutcomeField(r, "attempted"), 0);
  const totRs = filtered.reduce((s, r) => s + sumChatOutcomeField(r, "resolved"), 0);

  const rdList = filtered
    .map((r) => replyDiffFromRecord(r))
    .filter((v): v is number => v != null && Number.isFinite(Number(v)));
  const tcList = filtered
    .map((r) => totalConvFromRecord(r))
    .filter((v): v is number => v != null && Number.isFinite(Number(v)));

  const totalReplyDiff = rdList.length
    ? rdList.reduce((s, v) => s + Number(v), 0)
    : null;
  const totalConvDuration = tcList.length
    ? tcList.reduce((s, v) => s + Number(v), 0)
    : null;
  const avgReply = rdList.length
    ? rdList.reduce((s, v) => s + Number(v), 0) / rdList.length
    : null;
  const avgConv = tcList.length
    ? tcList.reduce((s, v) => s + Number(v), 0) / tcList.length
    : null;

  const byA: Record<
    string,
    { name: string; chats: number; rdList: number[]; tcList: number[] }
  > = {};
  for (const r of filtered) {
    const raw = String(r.analyst ?? "").trim();
    const key = raw.toLowerCase() || "—";
    if (!byA[key]) byA[key] = { name: raw || "—", chats: 0, rdList: [], tcList: [] };
    else if (raw && byA[key].name === "—") byA[key].name = raw;
    byA[key].chats++;
    const rd = replyDiffFromRecord(r);
    const tc = totalConvFromRecord(r);
    if (rd != null && Number.isFinite(rd)) byA[key].rdList.push(rd);
    if (tc != null && Number.isFinite(tc)) byA[key].tcList.push(tc);
  }

  const analystData = Object.values(byA)
    .map((a) => ({
      name: a.name,
      chats: a.chats,
      avgReply: a.rdList.length
        ? a.rdList.reduce((s, v) => s + v, 0) / a.rdList.length
        : null,
      avgConv: a.tcList.length
        ? a.tcList.reduce((s, v) => s + v, 0) / a.tcList.length
        : null,
    }))
    .sort((a, b) => b.chats - a.chats);

  const byT: Record<
    string,
    { name: string; chats: number; rdList: number[]; tcList: number[] }
  > = {};
  for (const r of filtered) {
    const k = String(r.team ?? "").trim() || "—";
    if (!byT[k]) byT[k] = { name: k, chats: 0, rdList: [], tcList: [] };
    byT[k].chats++;
    const rd = replyDiffFromRecord(r);
    const tc = totalConvFromRecord(r);
    if (rd != null && Number.isFinite(rd)) byT[k].rdList.push(rd);
    if (tc != null && Number.isFinite(tc)) byT[k].tcList.push(tc);
  }

  const teamData = Object.values(byT).map((t) => ({
    name: t.name,
    chats: t.chats,
    avgReply: t.rdList.length
      ? t.rdList.reduce((s, v) => s + v, 0) / t.rdList.length
      : null,
    avgConv: t.tcList.length
      ? t.tcList.reduce((s, v) => s + v, 0) / t.tcList.length
      : null,
  }));

  const byDate: Record<string, { date: string; chats: number; rdList: number[] }> = {};
  for (const r of filtered) {
    const d = r.date;
    if (!byDate[d]) byDate[d] = { date: d, chats: 0, rdList: [] };
    byDate[d].chats++;
    const rd = replyDiffFromRecord(r);
    if (rd != null && Number.isFinite(rd)) byDate[d].rdList.push(rd);
  }

  const dateData = Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date.replace(/^\d{4}-/, ""),
      chats: d.chats,
      avgReply: d.rdList.length
        ? +(d.rdList.reduce((s, v) => s + v, 0) / d.rdList.length).toFixed(2)
        : 0,
    }));

  const awaitingFirstReply = filtered.filter(
    (r) => !!(r.firstReceive && !r.firstReply),
  ).length;
  const openNoClose = filtered.filter(
    (r) => !!(r.firstReply && !r.analystLastReply),
  ).length;

  const attemptedPctRaw = totR > 0 ? (totA / totR) * 100 : 0;
  const resolvedPctRaw = totR > 0 ? (totRs / totR) * 100 : 0;

  return {
    n: filtered.length,
    totR,
    totA,
    totRs,
    attemptedPct: attemptedPctRaw.toFixed(2),
    resolvedPct: resolvedPctRaw.toFixed(2),
    totalReplyDiff,
    totalConvDuration,
    avgReply,
    avgConv,
    topAnalyst: analystData[0]
      ? { name: analystData[0].name, chats: analystData[0].chats }
      : null,
    analystData,
    teamData,
    dateData,
    awaitingFirstReply,
    openNoClose,
  };
}
