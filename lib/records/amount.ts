/** Max length for the dedicated amount-to-pay field. */
export const AMOUNT_TO_PAY_MAX_LEN = 40;

/**
 * Normalize a payment-follow-up amount for storage.
 * Keeps currency symbols and grouping (e.g. "Rs. 50,000") while stripping
 * control characters and excess length. Empty input stays empty.
 */
export function normalizeAmountToPay(value: unknown): string {
  const raw = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return "";
  return raw.slice(0, AMOUNT_TO_PAY_MAX_LEN);
}
