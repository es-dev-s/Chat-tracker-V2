import { NextResponse } from "next/server";
import { mapWriteError } from "@/lib/api/map-write-error";
import { bustWorkspaceCache, resolveApiViewer } from "@/lib/api/resolve-viewer";
import { isUnrestrictedTeamLead } from "@/lib/auth/scoping";
import { readRecordByIdForViewer } from "@/lib/db/records";
import { setChatRecordAcknowledged } from "@/lib/db/records-write";
import { publishRecordAcknowledgement } from "@/lib/realtime/publish-acknowledgement";

type RouteContext = { params: Promise<{ recordId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (viewer.role !== "mainTeamLead" && !isUnrestrictedTeamLead(viewer)) {
      return NextResponse.json({ error: "FIELD_FORBIDDEN" }, { status: 403 });
    }

    const { recordId: rawParam } = await context.params;
    const id = Number(decodeURIComponent(rawParam));
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid record id" }, { status: 400 });
    }

    const existing = await readRecordByIdForViewer(viewer, id);
    if (!existing) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const alreadyAcknowledged = Boolean(String(existing.acknowledgedAt ?? "").trim());
    const acknowledgedBy = String(viewer.email ?? "").trim() || null;
    const record = await setChatRecordAcknowledged(id, !alreadyAcknowledged, acknowledgedBy);
    bustWorkspaceCache(viewer.id);
    void publishRecordAcknowledgement({
      id: record.id,
      acknowledgedAt: record.acknowledgedAt ?? null,
      acknowledgedBy: record.acknowledgedBy ?? null,
    }).catch((err) => {
      console.error("acknowledgement broadcast", err);
    });
    return NextResponse.json({ record });
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    const missingColumn =
      /acknowledged_at|acknowledged_by/i.test(code) &&
      /could not find|does not exist|schema cache|undefined_column|42703|PGRST204/i.test(code);
    if (missingColumn) {
      return NextResponse.json(
        {
          error: "DATABASE_SCHEMA_OUTDATED",
          message:
            "The database is missing the record acknowledgement fields. Apply the acknowledgement migration, then retry.",
        },
        { status: 503 },
      );
    }
    return mapWriteError(err);
  }
}
