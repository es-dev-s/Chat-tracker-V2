function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Storage clock string HH:MM:SS (24h). */
export function formatTimeStorage(h: number, m: number, s = 0): string {
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) return "";
  if (h < 0 || h > 23 || m < 0 || m >= 60 || s < 0 || s >= 60) return "";
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** HH:MM:SS storage → Date (today's calendar date, used only for time fields). */
export function storedTimeToDate(value: string): Date {
  const raw = String(value ?? "").trim();
  const base = new Date();
  base.setMilliseconds(0);
  if (!raw) {
    base.setHours(12, 0, 0, 0);
    return base;
  }
  const parts = raw.split(":").map(Number);
  if (parts.length < 2 || parts.some((n, i) => i < 2 && !Number.isFinite(n))) {
    base.setHours(12, 0, 0, 0);
    return base;
  }
  const [h, m, s = 0] = parts;
  base.setHours(h, m, s, 0);
  return base;
}

/** Date → HH:MM:SS storage. */
export function dateToStoredTime(date: Date | null | undefined): string {
  if (!date) return "";
  return formatTimeStorage(date.getHours(), date.getMinutes(), 0);
}

/** HH:MM:SS → table-friendly 12-hour label (e.g. "2:53 AM"). */
export function formatStoredTimeDisplay(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parts = raw.split(":").map(Number);
  if (parts.length < 2 || parts.slice(0, 2).some((n) => !Number.isFinite(n))) return raw;
  const [h24, m] = parts;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${pad2(m)} ${period}`;
}

export type StoredTime12Parts = {
  hour12: string;
  minute: string;
  period: "AM" | "PM";
};

/** HH:MM:SS (24h storage) → 12-hour picker parts. */
export function storedTimeTo12Parts(value: string): StoredTime12Parts | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parts = raw.split(":").map(Number);
  if (parts.length < 2 || parts.slice(0, 2).some((n) => !Number.isFinite(n))) return null;
  const [h24, m] = parts;
  if (h24 < 0 || h24 > 23 || m < 0 || m >= 60) return null;
  return {
    hour12: String(h24 % 12 || 12),
    minute: pad2(m),
    period: h24 >= 12 ? "PM" : "AM",
  };
}

/** 12-hour picker parts → HH:MM:SS storage. */
export function parts12ToStoredTime(
  hour12: string,
  minute: string,
  period: "AM" | "PM",
): string {
  const h = parseInt(hour12, 10);
  const m = parseInt(minute, 10);
  if (!Number.isFinite(h) || h < 1 || h > 12) return "";
  if (!Number.isFinite(m) || m < 0 || m >= 60) return "";
  let h24 = h;
  if (period === "PM" && h < 12) h24 = h + 12;
  if (period === "AM" && h === 12) h24 = 0;
  return formatTimeStorage(h24, m, 0);
}
