#!/usr/bin/env node
// LAN dev launcher: lets other computers on your network use the LOCAL site.
// Overrides env in-process only (never edits .env / .env.local).
import os from "node:os";
import { spawn } from "node:child_process";

function lanIp() {
  if (process.env.LAN_IP) return process.env.LAN_IP.trim();
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    if (/^(docker|br-|virbr|veth|lo)/.test(name)) continue;
    for (const a of addrs || []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return null;
}

const ip = lanIp();
if (!ip) {
  console.error("Could not detect LAN IP. Run with LAN_IP=x.x.x.x npm run dev:lan");
  process.exit(1);
}
const port = process.env.PORT || "5666";
const env = {
  ...process.env,
  // Browser realtime + server both reach local Supabase via the LAN IP.
  SUPABASE_URL: `http://${ip}:54321`,
  NEXT_PUBLIC_SUPABASE_URL: `http://${ip}:54321`,
  CHATTRACKER_SESSION_SECURE: "false",
  CHATTRACKER_LAN_DEV_ORIGINS: [ip, "localhost", "127.0.0.1"].join(","),
};
console.log(`\n  LAN URL:   http://${ip}:${port}\n  Local URL: http://localhost:${port}\n`);
const child = spawn("npx", ["next", "dev", "-p", port, "-H", "0.0.0.0"], { stdio: "inherit", env });
child.on("exit", (code) => process.exit(code ?? 0));
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => child.kill(s));
