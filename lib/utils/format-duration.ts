import { diffEventMins } from "@/lib/utils/event-datetime";

export function parseTime(t = ""): number | null {
  const p = String(t ?? "")
    .trim()
    .split(":")
    .map(Number);
  if (p.length < 2 || p.some((n) => !Number.isFinite(n))) return null;
  const [h, m, s = 0] = p;
  if (h < 0 || m < 0 || m >= 60 || s < 0 || s >= 60) return null;
  return h * 60 + m + s / 60;
}

export function diffMins(t1: string, t2: string): number | null {
  const a = parseTime(t1);
  const b = parseTime(t2);
  return a != null && b != null ? b - a : null;
}

export function fmtMins(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(Number(minutes))) return "—";
  const n = Number(minutes);
  const sign = n < 0 ? "-" : "";
  const totalSec = Math.round(Math.abs(n) * 60);
  const h = Math.floor(totalSec / 3600);
  const mn = Math.floor((totalSec % 3600) / 60);
  const sc = totalSec % 60;
  return `${sign}${h}:${String(mn).padStart(2, "0")}:${String(sc).padStart(2, "0")}`;
}

export function replyDiffFromRecord(r: {
  date?: string;
  firstReceive?: string;
  firstReply?: string;
  firstReceiveDate?: string;
  firstReplyDate?: string;
  replyDiff?: number | null;
}): number | null {
  const recordDate = String(r.date ?? "").trim();
  const live = diffEventMins(
    r.firstReceiveDate ?? "",
    r.firstReceive ?? "",
    r.firstReplyDate ?? "",
    r.firstReply ?? "",
    recordDate,
  );
  if (live != null && Number.isFinite(live)) return live;
  const sameDay = diffMins(r.firstReceive ?? "", r.firstReply ?? "");
  if (sameDay != null && Number.isFinite(sameDay)) return sameDay;
  const stored = r.replyDiff;
  if (stored != null && Number.isFinite(Number(stored))) return Number(stored);
  return null;
}

export function totalConvFromRecord(r: {
  date?: string;
  firstReceive?: string;
  analystLastReply?: string;
  firstReceiveDate?: string;
  analystLastReplyDate?: string;
  totalConv?: number | null;
}): number | null {
  const recordDate = String(r.date ?? "").trim();
  const live = diffEventMins(
    r.firstReceiveDate ?? "",
    r.firstReceive ?? "",
    r.analystLastReplyDate ?? "",
    r.analystLastReply ?? "",
    recordDate,
  );
  if (live != null && Number.isFinite(live)) return live;
  const sameDay = diffMins(r.firstReceive ?? "", r.analystLastReply ?? "");
  if (sameDay != null && Number.isFinite(sameDay)) return sameDay;
  const stored = r.totalConv;
  if (stored != null && Number.isFinite(Number(stored))) return Number(stored);
  return null;
}
