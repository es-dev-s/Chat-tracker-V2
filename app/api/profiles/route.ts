import { NextResponse } from "next/server";
import { mapWriteError } from "@/lib/api/map-write-error";
import { bustWorkspaceCache, resolveApiViewer } from "@/lib/api/resolve-viewer";
import { findCaseInsensitiveDuplicate } from "@/lib/db/catalog-names";
import { readProfiles } from "@/lib/db/catalogs";
import { insertProfileName } from "@/lib/db/catalogs-write";

export async function POST(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (viewer.role !== "teamLead") {
      return NextResponse.json({ error: "PROFILES_FORBIDDEN" }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name : "";
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "PROFILE_NAME_REQUIRED" }, { status: 400 });
    }
    const existing = await readProfiles();
    const duplicate = findCaseInsensitiveDuplicate(trimmed, existing);
    if (duplicate) {
      return NextResponse.json(
        {
          error: "PROFILE_NAME_CONFLICT",
          message: `A profile named "${duplicate}" already exists. Duplicate profile names are not allowed.`,
          existingName: duplicate,
        },
        { status: 409 },
      );
    }
    await insertProfileName(trimmed);
    bustWorkspaceCache(viewer.id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return mapWriteError(err);
  }
}
