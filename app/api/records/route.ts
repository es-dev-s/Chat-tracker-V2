import { NextResponse } from "next/server";
import { checkViewerMayCommitRecord } from "@/lib/auth/record-write";
import {
  validateRecordTimeOrder,
  withValidatedRecordOutcomes,
} from "@/lib/auth/record-validation";
import { filterRecordsForViewer } from "@/lib/auth/scoping";
import { mapWriteError } from "@/lib/api/map-write-error";
import { bustWorkspaceCache, resolveApiViewer } from "@/lib/api/resolve-viewer";
import { insertChatRecord } from "@/lib/db/records-write";
import { readRecords } from "@/lib/db/records";

export async function GET(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const records = await readRecords();
    const scoped = filterRecordsForViewer(viewer, records);
    return NextResponse.json({ value: scoped });
  } catch (err) {
    console.error("records GET", err);
    return NextResponse.json({ error: "Failed to read records" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const raw = body?.record;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "RECORD_REQUIRED" }, { status: 400 });
    }
    const { id: _clientId, ...rest } = raw as Record<string, unknown>;
    void _clientId;
    const normalized = withValidatedRecordOutcomes(rest, undefined);
    validateRecordTimeOrder(normalized);
    const commitPost = checkViewerMayCommitRecord(viewer, normalized, undefined);
    if (!commitPost.ok) {
      return NextResponse.json({ error: commitPost.code }, { status: 403 });
    }
    const saved = await insertChatRecord(normalized);
    bustWorkspaceCache(viewer.id);
    return NextResponse.json({ record: saved }, { status: 201 });
  } catch (err) {
    return mapWriteError(err);
  }
}
