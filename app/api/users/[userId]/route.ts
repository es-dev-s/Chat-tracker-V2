import { NextResponse } from "next/server";
import { assertTeamLeadMayUpsertUser } from "@/lib/auth/merge-snapshots";
import { mergeUserFieldsForPatch } from "@/lib/auth/user-patch";
import {
  viewerMayDeleteUserAccount,
  viewerMaySeeUserPassword,
} from "@/lib/auth/user-write";
import { mapWriteError } from "@/lib/api/map-write-error";
import { bustWorkspaceCache, resolveApiViewer } from "@/lib/api/resolve-viewer";
import { readRecords } from "@/lib/db/records";
import { readUsers, stripPassword } from "@/lib/db/users";
import { deleteUserById, upsertTrackerUser } from "@/lib/db/users-write";

type RouteContext = { params: Promise<{ userId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const { userId: rawParam } = await context.params;
    const userId = decodeURIComponent(rawParam);
    const body = await request.json().catch(() => null);
    const raw = body?.user;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "USER_REQUIRED" }, { status: 400 });
    }
    const allUsers = await readUsers();
    const allRecords = await readRecords();
    const target = allUsers.find((u) => String(u.id) === String(userId));
    if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (raw.id != null && String(raw.id) !== String(userId)) {
      return NextResponse.json({ error: "ID_MISMATCH" }, { status: 400 });
    }
    const merged = mergeUserFieldsForPatch(target, raw as Record<string, unknown>);
    merged.id = target.id;
    merged.role = target.role;
    assertTeamLeadMayUpsertUser(viewer, target, merged, allRecords);
    await upsertTrackerUser(merged);
    bustWorkspaceCache(viewer.id);
    const withSecret = viewerMaySeeUserPassword(viewer, merged, allRecords)
      ? merged
      : stripPassword(merged);
    return NextResponse.json({ user: withSecret });
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
    const { userId: raw } = await context.params;
    const userId = decodeURIComponent(raw);
    const allUsers = await readUsers();
    const allRecords = await readRecords();
    const target = allUsers.find((u) => String(u.id) === String(userId));
    if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    if (!viewerMayDeleteUserAccount(viewer, target, allRecords)) {
      return NextResponse.json({ error: "USER_DELETE_FORBIDDEN" }, { status: 403 });
    }
    await deleteUserById(userId);
    bustWorkspaceCache(viewer.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("users DELETE", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
