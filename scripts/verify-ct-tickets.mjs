/**
 * Checks for Jira CT-16 (no Day field on Log WhatsApp Audit form) and CT-13
 * (Payment Record form: Payment Date, Payment Type, Payment Amount).
 * Imports the real TypeScript modules (Node 24 type stripping).
 * Run: node scripts/verify-ct-tickets.mjs
 * DB round-trip runs only when .env.local points at a local Supabase (127.0.0.1 / localhost).
 */
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Resolve "@/x" and extensionless relative imports to .ts files, like the Next.js bundler does.
registerHooks({
  resolve(specifier, context, next) {
    let spec = specifier;
    if (spec.startsWith("@/")) spec = pathToFileURL(path.join(root, spec.slice(2))).href;
    const fromProject = !String(context.parentURL || "").includes("/node_modules/");
    if (fromProject && (spec.startsWith("file:") || spec.startsWith("."))) {
      const base = spec.startsWith(".") ? new URL(spec, context.parentURL) : new URL(spec);
      const file = fileURLToPath(base);
      if (!path.extname(file)) {
        for (const ext of [".ts", ".tsx", "/index.ts"]) {
          if (fs.existsSync(file + ext)) return next(pathToFileURL(file + ext).href, context);
        }
      }
      return next(base.href, context);
    }
    return next(spec, context);
  },
});

for (const line of (fs.existsSync(path.join(root, ".env.local"))
  ? fs.readFileSync(path.join(root, ".env.local"), "utf8")
  : ""
).split("\n")) {
  const t = line.trim();
  const i = t.indexOf("=");
  if (!t || t.startsWith("#") || i < 1) continue;
  const k = t.slice(0, i).trim();
  if (!process.env[k]) process.env[k] = t.slice(i + 1).trim();
}

let failed = 0;
let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL ${name}\n       ${e instanceof Error ? e.message : e}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function eq(a, b, msg) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

// ---------------------------------------------------------------- CT-16
console.log("\nCT-16  Remove Day field from Log WhatsApp Audit form");
const walSrc = read("components/whatsapp-audit/LogWhatsAppAuditView.tsx");
const walForm = walSrc.slice(walSrc.indexOf("<form"), walSrc.indexOf("</form>"));

await check("form has no Day field", () => {
  assert(walForm.length > 0, "form markup not found");
  assert(!/>\s*Day\s*</.test(walForm), "a 'Day' label is still inside the form");
  assert(!walForm.includes("Filled from the date"), "Day hint still inside the form");
});
await check("remaining Chat details fields still present (Date, Shift, Team)", () => {
  for (const f of ["FIELD_ID.date", "FIELD_ID.shift", "FIELD_ID.team"]) assert(walForm.includes(f), `${f} missing`);
});
await check("Day is not part of the submitted audit input", async () => {
  const { emptyAuditInput } = await import("../lib/whatsapp-audit/types.ts");
  const keys = Object.keys(emptyAuditInput("2026-11-26"));
  assert(!keys.some((k) => /^(day|weekday)$/i.test(k)), `input has a day key: ${keys.join(", ")}`);
});

// ---------------------------------------------------------------- CT-13
console.log("\nCT-13  Update Payment Record form");
const pay = await import("../lib/payment-records/types.ts");
const good = {
  paymentDate: "2026-11-20",
  paymentType: "final",
  amount: "1,250.50",
  team: "Team A",
  profile: "Profile A",
  analyst: "Analyst A",
  clientName: "Client A",
  clientNumber: "",
};

await check("form fields: Payment Date, Payment Type, Payment Amount; old fields gone", () => {
  eq(pay.PAYMENT_FIELDS.slice(0, 3), ["paymentDate", "paymentType", "amount"], "first three fields");
  for (const old of ["fromDate", "toDate", "totalAmount", "initialAmount", "finalAmount"]) {
    assert(!pay.PAYMENT_FIELDS.includes(old), `${old} still a form field`);
    assert(!(old in pay.emptyPaymentDraft()), `${old} still in the draft`);
  }
});
await check("dropdown has exactly Initial Payment (AUD) and Final Payment (AUD)", () => {
  eq(pay.PAYMENT_TYPES.map((t) => pay.PAYMENT_TYPE_LABEL[t]), ["Initial Payment (AUD)", "Final Payment (AUD)"], "options");
});
await check("dialog UI: no From/To Date or Total/Initial/Final inputs; amount shown only after a type", () => {
  const src = read("components/payments/PaymentRecordFormDialog.tsx");
  for (const gone of ['"From Date"', '"To Date"', "Total Payment Amount", 'money("initialAmount"', 'money("finalAmount"']) {
    assert(!src.includes(gone), `${gone} still in the dialog`);
  }
  for (const label of ['label="Payment Date"', 'label="Payment Type"', 'label="Payment Amount (AUD)"']) {
    assert(src.includes(label), `${label} missing`);
  }
  assert(/\{form\.paymentType \? \(\s*<Field id=\{FIELD_ID\.amount\}/.test(src), "amount field is not gated on payment type");
});
await check("valid input passes and keeps the amount with its type", () => {
  const { value, errors } = pay.validatePaymentInput(good);
  eq(errors, {}, "errors");
  eq([value.paymentDate, value.paymentType, value.amount], ["2026-11-20", "final", 1250.5], "value");
});
await check("Payment Date, Payment Type and Payment Amount are required", () => {
  const { errors } = pay.validatePaymentInput({ ...good, paymentDate: "", paymentType: "", amount: "" });
  assert(errors.paymentDate && errors.paymentType && errors.amount, JSON.stringify(errors));
});
await check("rejects bad date, unknown type, zero and malformed amounts", () => {
  assert(pay.validatePaymentInput({ ...good, paymentDate: "2026-02-30" }).errors.paymentDate, "bad date accepted");
  assert(pay.validatePaymentInput({ ...good, paymentType: "total" }).errors.paymentType, "unknown type accepted");
  assert(pay.validatePaymentInput({ ...good, amount: "0" }).errors.amount, "zero accepted");
  assert(pay.validatePaymentInput({ ...good, amount: "12.345" }).errors.amount, "3 decimals accepted");
});
await check("date filter and top receivers use the single payment date / amount", () => {
  const rec = { paymentDate: "2026-11-20", amount: 100, analyst: "A" };
  assert(pay.paymentDateInRange(rec, "2026-11-20", "2026-11-20"), "same-day range excluded");
  assert(!pay.paymentDateInRange(rec, "2026-11-21", ""), "later range included");
  const top = pay.topPaymentReceivers([rec, { ...rec, amount: 50.25 }, { ...rec, analyst: "B", amount: 10 }]);
  eq(top.map((t) => [t.name, t.total]), [["A", 150.25], ["B", 10]], "ranking");
});

const url = process.env.SUPABASE_URL || "";
if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  const db = await import("../lib/db/payment-records.ts");
  const viewer = { id: "verify-ct13", role: "mainTeamLead" };
  for (const type of ["initial", "final"]) {
    await check(`DB round-trip (local Supabase): ${type} payment saves and reads back`, async () => {
      const { value } = pay.validatePaymentInput({ ...good, paymentType: type, amount: "321.40" });
      const saved = await db.insertPaymentRecord(viewer, value);
      try {
        const back = await db.readPaymentRecordById(saved.id);
        eq([back.paymentDate, back.paymentType, back.amount], ["2026-11-20", type, 321.4], "read back");
        const edited = await db.updatePaymentRecord(saved.id, { ...value, paymentDate: "2026-11-21", amount: 10 }, "verify");
        eq([edited.paymentDate, edited.amount], ["2026-11-21", 10], "after update");
      } finally {
        await db.deletePaymentRecord(saved.id);
      }
    });
  }
} else {
  console.log("  skip DB round-trip (SUPABASE_URL is not local)");
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
