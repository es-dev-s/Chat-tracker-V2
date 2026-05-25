import { NextResponse } from "next/server";
import { assertTeamLeadMayDeleteTeamName } from "@/lib/auth/merge-snapshots";
import { mapWriteError } from "@/lib/api/map-write-error";
import { bustWorkspaceCache, resolveApiViewer } from "@/lib/api/resolve-viewer";
import { readTeams } from "@/lib/db/catalogs";
import { removeTeamCascade } from "@/lib/db/catalogs-write";

type RouteContext = { params: Promise<{ teamName: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const viewer = await resolveApiViewer(_request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const { teamName: raw } = await context.params;
    const teamName = decodeURIComponent(raw);
    const existing = await readTeams();
    assertTeamLeadMayDeleteTeamName(viewer, existing, teamName);
    await removeTeamCascade(teamName);
    bustWorkspaceCache(viewer.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    if (code === "NOT_FOUND" || code === "TEAM_NOT_IN_CATALOG") {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return mapWriteError(err);
  }
}
