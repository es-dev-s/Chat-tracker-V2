const ISO_RX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDateString(s: string): boolean {
  if (typeof s !== "string" || !ISO_RX.test(s)) return false;
  const match = s.match(ISO_RX);
  if (!match) return false;
  const [, y, m, d] = match;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return (
    dt.getFullYear() === Number(y) &&
    dt.getMonth() === Number(m) - 1 &&
    dt.getDate() === Number(d)
  );
}

/** m is 0-based month */
export function parseIsoDateParts(s: string): { y: number; m: number; d: number } | null {
  if (!isValidIsoDateString(s)) return null;
  const match = s.match(ISO_RX);
  if (!match) return null;
  const [, y, m, d] = match;
  return { y: Number(y), m: Number(m) - 1, d: Number(d) };
}
