import { NextResponse } from "next/server";
import { computeTeamCatalogAfterAdd } from "@/lib/auth/merge-snapshots";
import { mapWriteError } from "@/lib/api/map-write-error";
import { bustWorkspaceCache, resolveApiViewer } from "@/lib/api/resolve-viewer";
import { readTeams } from "@/lib/db/catalogs";
import { insertTeamName } from "@/lib/db/catalogs-write";

export async function POST(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name : "";
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "TEAM_NAME_REQUIRED" }, { status: 400 });
    }
    const existing = await readTeams();
    if (existing.some((t) => String(t || "").trim().toLowerCase() === trimmed.toLowerCase())) {
      return NextResponse.json({ ok: true });
    }
    computeTeamCatalogAfterAdd(viewer, existing, trimmed);
    await insertTeamName(trimmed);
    bustWorkspaceCache(viewer.id);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    return mapWriteError(err);
  }
}
