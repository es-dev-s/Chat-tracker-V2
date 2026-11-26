import { isValidIsoDateString } from "@/lib/utils/date-iso";

export const PAYMENT_TYPES = ["initial", "final"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  initial: "Initial Payment (AUD)",
  final: "Final Payment (AUD)",
};

export function isPaymentType(v: unknown): v is PaymentType {
  return v === "initial" || v === "final";
}

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
  /** ISO YYYY-MM-DD, the day the payment was made. */
  paymentDate: string;
  paymentType: PaymentType;
  /** AUD amount of this payment. */
  amount: number;
  team: string;
  profile: string;
  /** Chat Analyst Name: the payment receiver used for the Top Payment Receiver ranking. */
  analyst: string;
  clientName: string;
  /** Optional; empty string when not given. */
  clientNumber: string;
};

/** Validated payload sent to the API and written to the database. */
export type PaymentRecordInput = {
  paymentDate: string;
  paymentType: PaymentType;
  amount: number;
  team: string;
  profile: string;
  analyst: string;
  clientName: string;
  clientNumber: string;
};

/** What the form holds while typing (amounts and count stay as text). */
export type PaymentRecordDraft = {
  paymentDate: string;
  /** "" until the user picks one. */
  paymentType: PaymentType | "";
  amount: string;
  team: string;
  profile: string;
  analyst: string;
  clientName: string;
  clientNumber: string;
};

export type PaymentRecordField = keyof PaymentRecordInput;
export type PaymentRecordFieldErrors = Partial<Record<PaymentRecordField, string>>;

export const PAYMENT_FIELDS: readonly PaymentRecordField[] = [
  "paymentDate",
  "paymentType",
  "amount",
  "clientName",
  "clientNumber",
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
    paymentDate: "",
    paymentType: "",
    amount: "",
    clientName: "",
    clientNumber: "",
    team: "",
    profile: "",
    analyst: "",
  };
}

export function paymentToDraft(r: PaymentRecord): PaymentRecordDraft {
  return {
    paymentDate: r.paymentDate,
    paymentType: r.paymentType,
    amount: amountToText(r.amount),
    clientName: r.clientName,
    clientNumber: r.clientNumber,
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

  const paymentDate = text(src.paymentDate);
  if (!paymentDate) errors.paymentDate = "Payment Date is required.";
  else if (!isValidIsoDateString(paymentDate)) errors.paymentDate = "Enter a valid date.";

  const typeRaw = text(src.paymentType);
  const paymentType: PaymentType = isPaymentType(typeRaw) ? typeRaw : "initial";
  if (!typeRaw) errors.paymentType = "Payment Type is required.";
  else if (!isPaymentType(typeRaw)) errors.paymentType = "Choose a valid Payment Type.";

  const cents = parseAmountCents(src.amount);
  if (text(src.amount) === "") errors.amount = "Payment Amount is required.";
  else if (cents == null) errors.amount = "Enter an amount like 1250 or 1250.50.";
  else if (cents > MAX_CENTS) errors.amount = "Amount is too large.";
  else if (cents === 0) errors.amount = "Payment Amount must be more than 0.";

  const clientName = text(src.clientName);
  if (!clientName) errors.clientName = "Client Name is required.";
  else if (clientName.length > PAYMENT_LIMITS.name) errors.clientName = "Client Name is too long.";
  const clientNumber = text(src.clientNumber);
  if (clientNumber.length > PAYMENT_LIMITS.name) errors.clientNumber = "Client Number is too long.";

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
      paymentDate,
      paymentType,
      amount: (cents ?? 0) / 100,
      team,
      profile,
      analyst,
      clientName,
      clientNumber,
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
  /** Sum of Payment Amount, AUD. */
  total: number;
  records: number;
};

/**
 * Ranks Chat Analyst Names by the sum of Payment Amount. Names match
 * case-insensitively. Ties go to more records, then A→Z, so the order is stable.
 */
export function topPaymentReceivers(records: readonly PaymentRecord[], limit = 3): TopReceiver[] {
  const byKey = new Map<string, { name: string; cents: number; records: number }>();
  for (const r of records) {
    const name = text(r.analyst);
    if (!name) continue;
    const key = name.toLowerCase();
    const cents = Math.round(r.amount * 100);
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

/** Whether the payment date falls in [from, to]. Blank bounds are open. */
export function paymentDateInRange(r: Pick<PaymentRecord, "paymentDate">, from: string, to: string): boolean {
  if (from && r.paymentDate < from) return false;
  if (to && r.paymentDate > to) return false;
  return true;
}
