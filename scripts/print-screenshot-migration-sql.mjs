/** Prints SQL to add chat screenshot columns. Run in Supabase SQL Editor. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlPath = path.join(
  root,
  "supabase/migrations/20260726140000_chat_screenshots.sql",
);
process.stdout.write(fs.readFileSync(sqlPath, "utf8"));
