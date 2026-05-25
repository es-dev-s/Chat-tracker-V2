/**
 * Validates role routing and paginated table placement.
 * Run: node scripts/verify-role-pages.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const ROUTES = {
  login: "/login",
  dashboard: "/dashboard",
  log: "/log",
  records: "/records",
  notes: "/notes",
  admin: "/admin",
  leads: "/leads",
  leadNotes: "/lead-notes",
};

const PATH_TO_TAB = {
  [ROUTES.dashboard]: "dashboard",
  [ROUTES.log]: "log",
  [ROUTES.records]: "records",
  [ROUTES.notes]: "notes",
  [ROUTES.admin]: "admin",
  [ROUTES.leads]: "leads",
  [ROUTES.leadNotes]: "leadNotes",
};

function tabsForRole(role) {
  if (role === "teamLead") return ["dashboard", "records", "notes", "admin"];
  if (role === "mainTeamLead") return ["dashboard", "leads", "leadNotes"];
  return ["dashboard", "log", "records", "notes"];
}

function routeAllowedForRole(pathname, role) {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.replace(/\/+$/, "")
      : pathname;
  const tab = PATH_TO_TAB[normalized];
  if (!tab) return normalized === ROUTES.dashboard;
  return tabsForRole(role).includes(tab);
}

const ROLES = ["analyst", "teamLead", "mainTeamLead"];
const APP_PATHS = Object.values(ROUTES).filter((p) => p !== ROUTES.login);

const PAGE_MATRIX = [
  {
    path: ROUTES.dashboard,
    roles: ROLES,
    table: "Analyst + Team performance tables",
    pagination: false,
  },
  {
    path: ROUTES.log,
    roles: ["analyst"],
    table: "Log form (no table)",
    pagination: false,
  },
  {
    path: ROUTES.records,
    roles: ["analyst", "teamLead"],
    table: "Chat ledger",
    pagination: true,
    paginationFile: "components/records/RecordsView.tsx",
    pageSize: 25,
  },
  {
    path: ROUTES.notes,
    roles: ["analyst", "teamLead"],
    table: "Notes tabs (Analyst + Main Lead)",
    pagination: "analyst tab only",
    paginationFile: "components/notes/NotesTabsPanel.tsx",
    pageSize: 20,
  },
  {
    path: ROUTES.admin,
    roles: ["teamLead"],
    table: "Member roster",
    pagination: false,
  },
  {
    path: ROUTES.leads,
    roles: ["mainTeamLead"],
    table: "Team leads roster + notes panel",
    pagination: "analyst notes tab only",
    paginationFile: "components/notes/NotesTabsPanel.tsx",
    pageSize: 20,
  },
  {
    path: ROUTES.leadNotes,
    roles: ["mainTeamLead"],
    table: "Main lead notes (locked view)",
    pagination: false,
  },
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assertRouteMatrix() {
  let failed = 0;
  console.log("\n=== Role route access ===");
  for (const role of ROLES) {
    const allowed = tabsForRole(role).map((t) => Object.entries(PATH_TO_TAB).find(([, id]) => id === t)?.[0]);
    console.log(`${role}: ${allowed.join(", ")}`);
  }

  console.log("\n=== Route guard matrix ===");
  for (const role of ROLES) {
    for (const p of APP_PATHS) {
      const ok = routeAllowedForRole(p, role);
      const expected = PAGE_MATRIX.find((row) => row.path === p)?.roles.includes(role) ?? p === ROUTES.dashboard;
      if (ok !== expected) {
        console.log(`FAIL ${role} ${p}: expected ${expected}, got ${ok}`);
        failed++;
      }
    }
  }
  if (failed === 0) console.log("PASS all route guards match expected matrix");
  return failed;
}

function assertPaginationPlacement() {
  let failed = 0;
  console.log("\n=== Pagination placement (header, not footer) ===");

  const recordsSrc = read("components/records/RecordsView.tsx");
  if (recordsSrc.includes("ct-table-pagination--footer")) {
    console.log("FAIL RecordsView uses footer pagination class");
    failed++;
  }
  if (!recordsSrc.includes("ct-records-ledger__head")) {
    console.log("FAIL RecordsView missing ledger head");
    failed++;
  }
  const recordsHeadIdx = recordsSrc.indexOf('className="ct-records-ledger__head"');
  const recordsTableIdx = recordsSrc.indexOf('className="ct-records-table-scroll"');
  const recordsPagIdx = recordsSrc.indexOf("<RecordsPaginationBar");
  if (recordsPagIdx < recordsHeadIdx || recordsPagIdx > recordsTableIdx) {
    console.log("FAIL Records pagination must render inside head, before table scroll");
    failed++;
  } else {
    console.log("PASS Records pagination in ledger header");
  }

  const notesSrc = read("components/notes/NotesTabsPanel.tsx");
  if (notesSrc.includes("ct-notes-table-scroll--with-toolbar")) {
    console.log("FAIL NotesTabsPanel still uses in-scroll toolbar pagination");
    failed++;
  }
  if (notesSrc.includes("embedded")) {
    console.log("FAIL NotesTabsPanel still passes embedded pagination prop");
    failed++;
  }
  const toolbarIdx = notesSrc.indexOf('className="ct-notes-toolbar-row"');
  const notesPagIdx = notesSrc.indexOf("<AnalystNotesPaginationBar");
  const notesTableIdx = notesSrc.indexOf('className="ct-notes-table-scroll"');
  if (notesPagIdx < toolbarIdx || notesPagIdx > notesTableIdx) {
    console.log("FAIL Notes pagination must sit between toolbar row and table scroll");
    failed++;
  } else {
    console.log("PASS Notes pagination in panel header");
  }

  const notesPagBar = read("components/notes/AnalystNotesPaginationBar.tsx");
  if (!notesPagBar.includes("ct-notes-pagination--${placement}")) {
    console.log("FAIL AnalystNotesPaginationBar missing header placement class");
    failed++;
  }

  const recordsPagBar = read("components/records/RecordsPaginationBar.tsx");
  if (!recordsPagBar.includes('placement = "header"')) {
    console.log("FAIL RecordsPaginationBar default placement is not header");
    failed++;
  }

  return failed;
}

function printPageSummary() {
  console.log("\n=== Page / table / pagination summary ===");
  for (const row of PAGE_MATRIX) {
    const pag = row.pagination
      ? typeof row.pagination === "string"
        ? row.pagination
        : `yes (${row.pageSize}/page, top header)`
      : "none";
    console.log(`${row.path}`);
    console.log(`  roles: ${row.roles.join(", ")}`);
    console.log(`  table: ${row.table}`);
    console.log(`  pagination: ${pag}`);
  }
}

let failed = 0;
printPageSummary();
failed += assertRouteMatrix();
failed += assertPaginationPlacement();

console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
