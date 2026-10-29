import { NextResponse } from "next/server";
import { mapWriteError } from "@/lib/api/map-write-error";
import { makeDisplayName } from "@/lib/utils/display-name";
import type { AppUser } from "@/lib/db/users";
import type { WhatsAppAuditFieldErrors } from "@/lib/whatsapp-audit/types";

export function isMissingAuditTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /whatsapp_audits/i.test(msg) &&
    /could not find|does not exist|schema cache|PGRST205|42P01|relation/i.test(msg)
  );
}

export function auditSchemaOutdated(): NextResponse {
  return NextResponse.json(
    {
      error: "DATABASE_SCHEMA_OUTDATED",
      message:
        "The WhatsApp Audit table is missing. Run supabase/cloud-scripts/whatsapp_audits.sql in the Supabase SQL editor, then retry.",
    },
    { status: 503 },
  );
}

export function auditErrorResponse(err: unknown, context: string): NextResponse {
  if (isMissingAuditTable(err)) return auditSchemaOutdated();
  console.error(context, err);
  return mapWriteError(err);
}

export function auditValidationResponse(fields: WhatsAppAuditFieldErrors): NextResponse {
  return NextResponse.json(
    {
      error: "VALIDATION_FAILED",
      message: Object.values(fields)[0] ?? "Check the highlighted fields.",
      fields,
    },
    { status: 400 },
  );
}

export function auditActorLabel(viewer: Partial<AppUser>): string {
  return String(viewer.email ?? "").trim() || makeDisplayName(viewer as never);
}

export function parseAuditId(raw: string): number | null {
  const id = Number(decodeURIComponent(raw));
  return Number.isInteger(id) && id > 0 ? id : null;
}
