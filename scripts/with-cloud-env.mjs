#!/usr/bin/env node
/**
 * Run a command against the PRODUCTION (cloud) Supabase settings in `.env`,
 * ignoring the local-test overrides in `.env.local`.
 *
 * Next.js normally lets `.env.local` win over `.env`. Real process env vars win
 * over every env file, so we load `.env` into process.env before starting Next.
 *
 *   npm run prod:local   -> build + start on http://localhost:5677 using cloud Supabase
 *
 * WARNING: anything you save while running this is written to the live database.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env");
if (!existsSync(envPath)) {
  console.error("✖ .env not found. It must contain the cloud SUPABASE_URL and keys.");
  process.exit(1);
}

const cloud = {};
for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq < 1) continue;
  const key = line.slice(0, eq).replace(/^export\s+/, "").trim();
  let value = line.slice(eq + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  cloud[key] = value;
}

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CHATTRACKER_SESSION_SECRET"];
const missing = required.filter((k) => !cloud[k]);
if (missing.length) {
  console.error(`✖ .env is missing: ${missing.join(", ")}`);
  process.exit(1);
}
if (/127\.0\.0\.1|localhost/.test(cloud.SUPABASE_URL)) {
  console.error("✖ .env SUPABASE_URL points to localhost — expected the cloud project.");
  process.exit(1);
}

const env = {
  ...process.env,
  // Blank the local-only standby so .env.local can't route reads to Docker.
  SUPABASE_URL_SECONDARY: "",
  SUPABASE_SERVICE_ROLE_KEY_SECONDARY: "",
  // Plain http on localhost, so the session cookie must not require HTTPS.
  CHATTRACKER_SESSION_SECURE: "false",
  ...cloud,
};
delete env.PORT; // the port comes from the command line

const host = new URL(cloud.SUPABASE_URL).hostname.split(".")[0];
console.log(`\n⚠  PRODUCTION DATABASE (${host.slice(0, 6)}…) — changes here are live.\n`);

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Usage: node scripts/with-cloud-env.mjs <command> [...args]");
  process.exit(1);
}
const child = spawn(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
child.on("exit", (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 0)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
