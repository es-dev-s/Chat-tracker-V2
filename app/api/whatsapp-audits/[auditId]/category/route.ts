import { NextResponse } from "next/server";
import { resolveApiViewer } from "@/lib/api/resolve-viewer";
import {
  auditActorLabel,
  auditErrorResponse,
  parseAuditId,
} from "@/lib/api/whatsapp-audit-response";
import { readWhatsAppAuditById, setWhatsAppAuditCategory } from "@/lib/db/whatsapp-audits";
import { publishWhatsAppAuditChange } from "@/lib/realtime/publish-whatsapp-audit";
import { normalizeReplyTiming, type ReplyTiming } from "@/lib/records/reply-timing";
import { auditVisibleToViewer, canSetAuditCategory } from "@/lib/whatsapp-audit/access";

type RouteContext = { params: Promise<{ auditId: string }> };

/** PATCH body: `{ category: "same_day" | … | null }`. Leads in scope, or the analyst who logged it. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const id = parseAuditId((await context.params).auditId);
    if (id == null) return NextResponse.json({ error: "Invalid audit id" }, { status: 400 });

    const body = (await request.json().catch(() => null)) as { category?: unknown } | null;
    if (!body || typeof body !== "object" || !("category" in body)) {
      return NextResponse.json(
        { error: "CATEGORY_REQUIRED", message: "category is required (slug or null)." },
        { status: 400 },
      );
    }
    let next: ReplyTiming | null = null;
    if (body.category != null && String(body.category).trim() !== "") {
      next = normalizeReplyTiming(body.category);
      if (!next) {
        return NextResponse.json(
          { error: "CATEGORY_INVALID", message: "Category must be one of the listed options." },
          { status: 400 },
        );
      }
    }

    const existing = await readWhatsAppAuditById(id);
    if (!existing || !auditVisibleToViewer(viewer, existing)) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    if (!canSetAuditCategory(viewer, existing)) {
      return NextResponse.json({ error: "FIELD_FORBIDDEN" }, { status: 403 });
    }

    const audit = await setWhatsAppAuditCategory(id, next, auditActorLabel(viewer));
    if (!audit) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    void publishWhatsAppAuditChange({ op: "updated", id }).catch((err) =>
      console.error("whatsapp-audit broadcast", err),
    );
    return NextResponse.json({ audit });
  } catch (err) {
    return auditErrorResponse(err, "whatsapp-audits category PATCH");
  }
}
