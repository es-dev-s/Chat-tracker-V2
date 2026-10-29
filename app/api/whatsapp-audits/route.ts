import { NextResponse } from "next/server";
import { resolveApiViewer } from "@/lib/api/resolve-viewer";
import {
  auditErrorResponse,
  auditValidationResponse,
} from "@/lib/api/whatsapp-audit-response";
import { insertWhatsAppAudit, listWhatsAppAuditsForViewer } from "@/lib/db/whatsapp-audits";
import { publishWhatsAppAuditChange } from "@/lib/realtime/publish-whatsapp-audit";
import { makeDisplayName } from "@/lib/utils/display-name";
import { canCreateAuditForTeam } from "@/lib/whatsapp-audit/access";
import { validateAuditInput } from "@/lib/whatsapp-audit/types";

export const dynamic = "force-dynamic";

/** GET: WhatsApp Audit entries the caller may see (analyst: own; leads: their teams; super admin: all). */
export async function GET(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const audits = await listWhatsAppAuditsForViewer(viewer);
    return NextResponse.json(
      { audits },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return auditErrorResponse(err, "whatsapp-audits GET");
  }
}

/** POST body: `{ audit: { date, shift, team, profile, clientName, clientMsgReceived, replyTime, category, clientMessage } }` */
export async function POST(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const body = (await request.json().catch(() => null)) as { audit?: unknown } | null;
    if (!body || typeof body.audit !== "object" || body.audit === null) {
      return NextResponse.json({ error: "AUDIT_REQUIRED", message: "Missing audit." }, { status: 400 });
    }

    const { value, errors } = validateAuditInput(body.audit);
    if (Object.keys(errors).length) return auditValidationResponse(errors);

    if (!canCreateAuditForTeam(viewer, value.team)) {
      return NextResponse.json(
        { error: "TEAM_OUT_OF_SCOPE", message: "You can only log audits for your own team." },
        { status: 403 },
      );
    }

    const audit = await insertWhatsAppAudit(viewer, makeDisplayName(viewer as never), value);
    void publishWhatsAppAuditChange({ op: "created", id: audit.id }).catch((err) =>
      console.error("whatsapp-audit broadcast", err),
    );
    return NextResponse.json({ audit }, { status: 201 });
  } catch (err) {
    return auditErrorResponse(err, "whatsapp-audits POST");
  }
}
