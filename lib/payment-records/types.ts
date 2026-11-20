import { isValidIsoDateString } from "@/lib/utils/date-iso";

/**
 * Payment Record. Its own dataset (`public.payment_records`), separate from chat
 * records. All amounts are AUD.
 */
export type PaymentRecord = {
  id: number;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  /** Role of whoever added it: "analyst" or "mainTeamLead". Drives who can see it. */
  createdByRole: string;
  /** ISO YYYY-MM-DD, start of the payment period. */
  fromDate: string;
  /** ISO YYYY-MM-DD, end of the payment period. */
  toDate: string;
  totalAmount: number;
  initialAmount: number;
  finalAmount: number;
  paymentCount: number;
  team: string;
  profile: string;
  /** Chat Analyst Name: the payment receiver used for the Top Payment Receiver ranking. */
  analyst: string;
};

/** Validated payload sent to the API and written to the database. */
export type PaymentRecordInput = {
  fromDate: string;
  toDate: string;
  totalAmount: number;
  initialAmount: number;
  finalAmount: number;
  paymentCount: number;
  team: string;
  profile: string;
  analyst: string;
};

/** What the form holds while typing (amounts and count stay as text). */
export type PaymentRecordDraft = {
  fromDate: string;
  toDate: string;
  totalAmount: string;
  initialAmount: string;
  finalAmount: string;
  paymentCount: string;
  team: string;
  profile: string;
  analyst: string;
};

export type PaymentRecordField = keyof PaymentRecordInput;
export type PaymentRecordFieldErrors = Partial<Record<PaymentRecordField, string>>;

export const PAYMENT_FIELDS: readonly PaymentRecordField[] = [
  "fromDate",
  "toDate",
  "totalAmount",
  "initialAmount",
  "finalAmount",
  "paymentCount",
  "team",
  "profile",
  "analyst",
];

export const PAYMENT_LIMITS = {
  name: 120,
  /** numeric(12,2) holds up to 9,999,999,999.99; stay well inside it. */
  maxAmount: 999_999_999.99,
  maxPayments: 1000,
} as const;

export function emptyPaymentDraft(): PaymentRecordDraft {
  return {
    fromDate: "",
    toDate: "",
    totalAmount: "",
    initialAmount: "",
    finalAmount: "",
    paymentCount: "",
    team: "",
    profile: "",
    analyst: "",
  };
}

export function paymentToDraft(r: PaymentRecord): PaymentRecordDraft {
  return {
    fromDate: r.fromDate,
    toDate: r.toDate,
    totalAmount: amountToText(r.totalAmount),
    initialAmount: amountToText(r.initialAmount),
    finalAmount: amountToText(r.finalAmount),
    paymentCount: String(r.paymentCount),
    team: r.team,
    profile: r.profile,
    analyst: r.analyst,
  };
}

function amountToText(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : "";
}

function text(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * "1,234.5" / 1234.5 → integer cents (123450). Null when blank or not a plain
 * non-negative amount with at most 2 decimals. Works in cents so sums are exact.
 */
export function parseAmountCents(value: unknown): number | null {
  const raw = String(value ?? "").replace(/[,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const [whole, frac = ""] = raw.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

const MAX_CENTS = Math.round(PAYMENT_LIMITS.maxAmount * 100);

/** Whole number of payments, as text or number. Null when not a positive integer. */
export function parsePaymentCount(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Validates a full record. Shared by the form (inline errors) and the API
 * (authoritative). Returns cleaned values plus per-field messages.
 */
export function validatePaymentInput(raw: unknown): {
  value: PaymentRecordInput;
  errors: PaymentRecordFieldErrors;
} {
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: PaymentRecordFieldErrors = {};

  const fromDate = text(src.fromDate);
  if (!fromDate) errors.fromDate = "From Date is required.";
  else if (!isValidIsoDateString(fromDate)) errors.fromDate = "Enter a valid date.";

  const toDate = text(src.toDate);
  if (!toDate) errors.toDate = "To Date is required.";
  else if (!isValidIsoDateString(toDate)) errors.toDate = "Enter a valid date.";
  else if (!errors.fromDate && toDate < fromDate) errors.toDate = "To Date can't be before From Date.";

  const amount = (key: "totalAmount" | "initialAmount" | "finalAmount", label: string): number => {
    const blank = text(src[key]) === "";
    const cents = parseAmountCents(src[key]);
    if (blank) errors[key] = `${label} is required.`;
    else if (cents == null) errors[key] = "Enter an amount like 1250 or 1250.50.";
    else if (cents > MAX_CENTS) errors[key] = "Amount is too large.";
    else if (key === "totalAmount" && cents === 0) errors[key] = "Total Payment Amount must be more than 0.";
    return cents ?? 0;
  };
  const totalCents = amount("totalAmount", "Total Payment Amount");
  const initialCents = amount("initialAmount", "Initial Payment");
  const finalCents = amount("finalAmount", "Final Payment");
  if (!errors.totalAmount && !errors.initialAmount && !errors.finalAmount && initialCents + finalCents > totalCents) {
    errors.finalAmount = "Initial + Final Payment can't be more than the Total Payment Amount.";
  }

  let paymentCount = 0;
  if (text(src.paymentCount) === "") errors.paymentCount = "Total Number of Payments is required.";
  else {
    const n = parsePaymentCount(src.paymentCount);
    if (n == null) errors.paymentCount = "Enter a whole number.";
    else if (n < 1 || n > PAYMENT_LIMITS.maxPayments)
      errors.paymentCount = `Enter a number from 1 to ${PAYMENT_LIMITS.maxPayments}.`;
    else paymentCount = n;
  }

  const name = (key: "team" | "profile" | "analyst", label: string): string => {
    const v = text(src[key]);
    if (!v) errors[key] = `${label} is required.`;
    else if (v.length > PAYMENT_LIMITS.name) errors[key] = `${label} is too long.`;
    return v;
  };
  const team = name("team", "Team Name");
  const profile = name("profile", "Profile Name");
  const analyst = name("analyst", "Chat Analyst Name");

  return {
    value: {
      fromDate,
      toDate,
      totalAmount: totalCents / 100,
      initialAmount: initialCents / 100,
      finalAmount: finalCents / 100,
      paymentCount,
      team,
      profile,
      analyst,
    },
    errors,
  };
}

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PLAIN = new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1250.5 → "1,250.50" (table cells; the column header says AUD). */
export function formatAmount(n: number): string {
  return PLAIN.format(Number.isFinite(n) ? n : 0);
}

/** 1250.5 → "AUD 1,250.50" */
export function formatAud(n: number): string {
  return AUD.format(Number.isFinite(n) ? n : 0).replace(/ /g, " ");
}

/** ISO → D/M/YYYY (Australian order, matching AUD amounts). */
export function formatPaymentDate(iso: string): string {
  if (!isValidIsoDateString(iso)) return iso || "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}/${m}/${y}`;
}

export type TopReceiver = {
  name: string;
  /** Sum of Total Payment Amount, AUD. */
  total: number;
  records: number;
};

/**
 * Ranks Chat Analyst Names by the sum of Total Payment Amount. Names match
 * case-insensitively. Ties go to more records, then A→Z, so the order is stable.
 */
export function topPaymentReceivers(records: readonly PaymentRecord[], limit = 3): TopReceiver[] {
  const byKey = new Map<string, { name: string; cents: number; records: number }>();
  for (const r of records) {
    const name = text(r.analyst);
    if (!name) continue;
    const key = name.toLowerCase();
    const cents = Math.round(r.totalAmount * 100);
    const hit = byKey.get(key);
    if (hit) {
      hit.cents += cents;
      hit.records += 1;
    } else {
      byKey.set(key, { name, cents, records: 1 });
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.cents - a.cents || b.records - a.records || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((x) => ({ name: x.name, total: x.cents / 100, records: x.records }));
}

/** Whether the record's period overlaps [from, to]. Blank bounds are open. */
export function periodOverlaps(r: Pick<PaymentRecord, "fromDate" | "toDate">, from: string, to: string): boolean {
  if (from && r.toDate < from) return false;
  if (to && r.fromDate > to) return false;
  return true;
}
