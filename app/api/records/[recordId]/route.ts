import { NextResponse } from "next/server";
import {
  checkViewerMayCommitRecord,
  viewerMayDeleteChatRecord,
} from "@/lib/auth/record-write";
import {
  validateRecordTimeOrder,
  withValidatedRecordOutcomes,
} from "@/lib/auth/record-validation";
import { mapWriteError } from "@/lib/api/map-write-error";
import { bustWorkspaceCache, resolveApiViewer } from "@/lib/api/resolve-viewer";
import { withCanonicalRecordTeam } from "@/lib/db/record-normalize";
import { readRecordByIdForViewer } from "@/lib/db/records";
import { deleteChatRecordById, upsertChatRecord } from "@/lib/db/records-write";

type RouteContext = { params: Promise<{ recordId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const { recordId: rawParam } = await context.params;
    const id = Number(decodeURIComponent(rawParam));
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid record id" }, { status: 400 });
    }
    const body = await request.json().catch(() => null);
    const raw = body?.record;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "RECORD_REQUIRED" }, { status: 400 });
    }
    const rec = await withCanonicalRecordTeam({
      ...(raw as Record<string, unknown>),
      id,
    });
    if (Number(rec.id) !== id) {
      return NextResponse.json({ error: "ID_MISMATCH" }, { status: 400 });
    }
    const existingRow = await readRecordByIdForViewer(viewer, id);
    if (!existingRow) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const normalized = withValidatedRecordOutcomes(rec, existingRow);
    validateRecordTimeOrder(normalized);
    const commitPatch = checkViewerMayCommitRecord(viewer, normalized, existingRow);
    if (!commitPatch.ok) {
      return NextResponse.json({ error: commitPatch.code }, { status: 403 });
    }
    await upsertChatRecord(normalized);
    bustWorkspaceCache(viewer.id);
    return NextResponse.json({ record: normalized });
  } catch (err) {
    return mapWriteError(err);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const viewer = await resolveApiViewer(_request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const { recordId: raw } = await context.params;
    const id = Number(decodeURIComponent(raw));
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid record id" }, { status: 400 });
    }
    const row = await readRecordByIdForViewer(viewer, id);
    if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (!viewerMayDeleteChatRecord(viewer, row)) {
      return NextResponse.json({ error: "RECORD_DELETE_FORBIDDEN" }, { status: 403 });
    }
    await deleteChatRecordById(id);
    bustWorkspaceCache(viewer.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("records DELETE", err);
    return NextResponse.json({ error: "Failed to delete record" }, { status: 500 });
  }
}
