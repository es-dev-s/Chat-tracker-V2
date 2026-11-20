import { NextResponse } from "next/server";
import { mapWriteError } from "@/lib/api/map-write-error";
import { makeDisplayName } from "@/lib/utils/display-name";
import type { AppUser } from "@/lib/db/users";
import type { PaymentRecordFieldErrors } from "@/lib/payment-records/types";

export function isMissingPaymentTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /payment_records/i.test(msg) &&
    /could not find|does not exist|schema cache|PGRST205|42P01|relation/i.test(msg)
  );
}

export function paymentSchemaOutdated(): NextResponse {
  return NextResponse.json(
    {
      error: "DATABASE_SCHEMA_OUTDATED",
      message:
        "The Payment Records table is missing. Run supabase/cloud-scripts/payment_records.sql in the Supabase SQL editor, then retry.",
    },
    { status: 503 },
  );
}

export function paymentErrorResponse(err: unknown, context: string): NextResponse {
  if (isMissingPaymentTable(err)) return paymentSchemaOutdated();
  console.error(context, err);
  return mapWriteError(err);
}

export function paymentValidationResponse(fields: PaymentRecordFieldErrors): NextResponse {
  return NextResponse.json(
    {
      error: "VALIDATION_FAILED",
      message: Object.values(fields)[0] ?? "Check the highlighted fields.",
      fields,
    },
    { status: 400 },
  );
}

export function paymentActorLabel(viewer: Partial<AppUser>): string {
  return String(viewer.email ?? "").trim() || makeDisplayName(viewer as never);
}

export function parsePaymentId(raw: string): number | null {
  const id = Number(decodeURIComponent(raw));
  return Number.isInteger(id) && id > 0 ? id : null;
}
