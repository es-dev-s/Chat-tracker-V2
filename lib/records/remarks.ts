/** Predefined remark types on Log Chat. Stored inside the existing note field. */
export const REMARK_OPTIONS = [
  "New Inquiry (CDR or other occupation)",
  "Payment Inquiry (bank details)",
  "Files Delay Concern",
  "EA/ other occupation feedback",
  "CV check request",
  "Draft files request",
  "Portal upload request",
  "Payment made - work pending",
  "Others",
  "Lost",
  "Need a call",
  "Negotiating client",
  "Waiting for the update",
  "Document check request",
] as const;

export type RemarkOption = (typeof REMARK_OPTIONS)[number];

const MARKER = "[[ct-remark]]";

function isRemarkOption(value: string): value is RemarkOption {
  return (REMARK_OPTIONS as readonly string[]).includes(value);
}

/**
 * Pack a remark type and extra text into the existing `note` column.
 * Plain notes (no type) are stored unchanged so older records keep working.
 */
export function composeRemarkNote(category: string, details: string): string {
  const cat = String(category ?? "").trim();
  const text = String(details ?? "");
  if (!isRemarkOption(cat)) return text;
  const body = text.trim();
  if (!body) return `${MARKER}${cat}`;
  return `${MARKER}${cat}\n${body}`;
}

export function parseRemarkNote(stored: string): { category: string; details: string } {
  const raw = String(stored ?? "").replace(/\r\n/g, "\n");
  if (!raw.startsWith(MARKER)) return { category: "", details: raw };
  const rest = raw.slice(MARKER.length);
  const nl = rest.indexOf("\n");
  const category = (nl === -1 ? rest : rest.slice(0, nl)).trim();
  const details = nl === -1 ? "" : rest.slice(nl + 1);
  if (!isRemarkOption(category)) return { category: "", details: raw };
  return { category, details };
}

/** Readable text for Notes and record detail. Hides the storage marker. */
export function formatRemarkNoteDisplay(stored: string): string {
  const { category, details } = parseRemarkNote(stored);
  if (!category) return String(stored ?? "").trim();
  const body = details.trim();
  return body ? `${category}\n${body}` : category;
}
