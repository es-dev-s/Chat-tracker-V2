import { NextResponse } from "next/server";
import { resolveApiViewer } from "@/lib/api/resolve-viewer";
import {
  auditActorLabel,
  auditErrorResponse,
  auditValidationResponse,
  parseAuditId,
} from "@/lib/api/whatsapp-audit-response";
import {
  deleteWhatsAppAudit,
  readWhatsAppAuditById,
  updateWhatsAppAudit,
} from "@/lib/db/whatsapp-audits";
import { publishWhatsAppAuditChange } from "@/lib/realtime/publish-whatsapp-audit";
import {
  auditVisibleToViewer,
  canCreateAuditForTeam,
  canDeleteAudit,
  canEditAuditFields,
} from "@/lib/whatsapp-audit/access";
import { validateAuditInput } from "@/lib/whatsapp-audit/types";

type RouteContext = { params: Promise<{ auditId: string }> };

/** PATCH body: `{ audit: {...all fields} }`. Owner analyst or super admin. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const id = parseAuditId((await context.params).auditId);
    if (id == null) return NextResponse.json({ error: "Invalid audit id" }, { status: 400 });

    const body = (await request.json().catch(() => null)) as { audit?: unknown } | null;
    if (!body || typeof body.audit !== "object" || body.audit === null) {
      return NextResponse.json({ error: "AUDIT_REQUIRED", message: "Missing audit." }, { status: 400 });
    }

    const existing = await readWhatsAppAuditById(id);
    if (!existing || !auditVisibleToViewer(viewer, existing)) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (!canEditAuditFields(viewer, existing)) {
      return NextResponse.json({ error: "FIELD_FORBIDDEN" }, { status: 403 });
    }

    const { value, errors } = validateAuditInput(body.audit);
    if (Object.keys(errors).length) return auditValidationResponse(errors);
    if (value.team.toLowerCase() !== existing.team.toLowerCase() && !canCreateAuditForTeam(viewer, value.team)) {
      return NextResponse.json(
        { error: "TEAM_OUT_OF_SCOPE", message: "You can only log audits for your own team." },
        { status: 403 },
      );
    }

    const audit = await updateWhatsAppAudit(id, value, auditActorLabel(viewer));
    if (!audit) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    void publishWhatsAppAuditChange({ op: "updated", id }).catch((err) =>
      console.error("whatsapp-audit broadcast", err),
    );
    return NextResponse.json({ audit });
  } catch (err) {
    return auditErrorResponse(err, "whatsapp-audits PATCH");
  }
}

/** DELETE: team leads (super admin: any row; others: their teams). */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const id = parseAuditId((await context.params).auditId);
    if (id == null) return NextResponse.json({ error: "Invalid audit id" }, { status: 400 });

    const existing = await readWhatsAppAuditById(id);
    if (!existing || !auditVisibleToViewer(viewer, existing)) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (!canDeleteAudit(viewer, existing)) {
      return NextResponse.json({ error: "AUDIT_DELETE_FORBIDDEN" }, { status: 403 });
    }
    await deleteWhatsAppAudit(id);
    void publishWhatsAppAuditChange({ op: "deleted", id }).catch((err) =>
      console.error("whatsapp-audit broadcast", err),
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return auditErrorResponse(err, "whatsapp-audits DELETE");
  }
}
