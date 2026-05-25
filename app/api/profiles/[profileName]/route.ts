import { NextResponse } from "next/server";
import { mapWriteError } from "@/lib/api/map-write-error";
import { bustWorkspaceCache, resolveApiViewer } from "@/lib/api/resolve-viewer";
import { readProfiles } from "@/lib/db/catalogs";
import { deleteProfileByName } from "@/lib/db/catalogs-write";

type RouteContext = { params: Promise<{ profileName: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const viewer = await resolveApiViewer(_request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (viewer.role !== "teamLead") {
      return NextResponse.json({ error: "PROFILES_FORBIDDEN" }, { status: 403 });
    }
    const { profileName: raw } = await context.params;
    const profileName = decodeURIComponent(raw);
    const existing = await readProfiles();
    if (
      !existing.some(
        (name) => String(name || "").trim().toLowerCase() === profileName.trim().toLowerCase(),
      )
    ) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    await deleteProfileByName(profileName);
    bustWorkspaceCache(viewer.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapWriteError(err);
  }
}
