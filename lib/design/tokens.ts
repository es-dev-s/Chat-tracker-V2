export const C = {
  bg: "#f3f7fd",
  surface: "#ffffff",
  card: "#ffffff",
  card2: "#f6f9fd",
  border: "#ebf1fa",
  dim: "#edf2fa",
  accent: "#2563eb",
  cyan: "#1d4ed8",
  violet: "#2563eb",
  green: "#16a34a",
  red: "#dc2626",
  orange: "#d97706",
  text: "#0f172a",
  muted: "#64748b",
  label: "#475569",
} as const;

export const MONO =
  "var(--font-jetbrains-mono), ui-monospace, monospace";
export const SANS =
  "var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const TYPE = {
  pageTitle: {
    fontSize: 26,
    fontWeight: 600,
    letterSpacing: "-0.032em",
    lineHeight: 1.08,
  },
  pageEyebrow: {
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: "-0.01em",
    opacity: 0.88,
  },
  fieldUpper: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
  bodySm: { fontSize: 13, fontWeight: 400, lineHeight: 1.45 },
  caption: { fontSize: 12, fontWeight: 400, lineHeight: 1.4 },
  sectionUpper: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
  },
};

export const RAD = { sm: 8, md: 10, lg: 14, xl: 16 } as const;
export const SPACE = { pageX: 20, pageY: 18, chromeY: 11 } as const;
