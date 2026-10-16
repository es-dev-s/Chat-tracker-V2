import { NextResponse } from "next/server";
import { mapWriteError } from "@/lib/api/map-write-error";
import { bustWorkspaceCache, resolveApiViewer } from "@/lib/api/resolve-viewer";
import { isUnrestrictedTeamLead } from "@/lib/auth/scoping";
import { readRecordByIdForViewer } from "@/lib/db/records";
import { setChatRecordReplyTiming } from "@/lib/db/records-write";
import { normalizeReplyTiming, type ReplyTiming } from "@/lib/records/reply-timing";
import { publishRecordReplyTiming } from "@/lib/realtime/publish-reply-timing";

type RouteContext = { params: Promise<{ recordId: string }> };

/**
 * PATCH body: `{ replyTiming: "same_day" | … | null }`
 * Only mainTeamLead or unrestricted (admin) teamLead may call this.
 */
export async function PATCH(request: Request, context: RouteContext) {
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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || !("replyTiming" in body)) {
      return NextResponse.json(
        { error: "REPLY_TIMING_REQUIRED", message: "replyTiming is required (slug or null)." },
        { status: 400 },
      );
    }

    const raw = (body as { replyTiming: unknown }).replyTiming;
    let next: ReplyTiming | null;
    if (raw === null || raw === undefined || String(raw).trim() === "") {
      next = null;
    } else {
      const timing = normalizeReplyTiming(raw);
      if (!timing) {
        return NextResponse.json(
          {
            error: "REPLY_TIMING_INVALID",
            message: "Reply timing must be one of the listed options.",
          },
          { status: 400 },
        );
      }
      next = timing;
    }

    const existing = await readRecordByIdForViewer(viewer, id);
    if (!existing) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const record = await setChatRecordReplyTiming(id, next);
    bustWorkspaceCache(viewer.id);
    void publishRecordReplyTiming({
      id: record.id,
      replyTiming: record.replyTiming ?? null,
    }).catch((err) => {
      console.error("reply-timing broadcast", err);
    });
    return NextResponse.json({ record });
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    const missingColumn =
      /reply_timing/i.test(code) &&
      /could not find|does not exist|schema cache|undefined_column|42703|PGRST204/i.test(code);
    if (missingColumn) {
      return NextResponse.json(
        {
          error: "DATABASE_SCHEMA_OUTDATED",
          message:
            "The database is missing the Reply timing field. Apply the reply_timing migration, then retry.",
        },
        { status: 503 },
      );
    }
    return mapWriteError(err);
  }
}
