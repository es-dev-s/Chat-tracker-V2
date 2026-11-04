import type { NextConfig } from "next";

// Dev-only: extra hosts allowed to load /_next dev assets + HMR (set by scripts/dev-lan.mjs).
// Ignored by `next start`, so production is unaffected.
const lanDevOrigins = (process.env.CHATTRACKER_LAN_DEV_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  ...(lanDevOrigins.length ? { allowedDevOrigins: lanDevOrigins } : {}),
};

export default nextConfig;
