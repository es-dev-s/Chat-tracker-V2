import { NextResponse } from "next/server";
import {
  bearerFromAuthHeader,
  getTokenFromCookies,
  resolveViewerFromToken,
} from "@/lib/auth/session-server";
import { hydrateSessionUser, loadWorkspaceData } from "@/lib/workspace/load-workspace";

/** @deprecated Use /api/workspace — kept for backward compatibility */
export async function GET(request: Request) {
  try {
    const cookieToken = await getTokenFromCookies();
    const headerToken = bearerFromAuthHeader(request.headers.get("authorization"));
    const viewer = await resolveViewerFromToken(headerToken || cookieToken);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const payload = await loadWorkspaceData(hydrateSessionUser(viewer));
    return NextResponse.json({
      records: payload.records,
      dismissedNotifs: payload.dismissedNotifs,
      notifUserKey: payload.notifUserKey,
    });
  } catch (err) {
    console.error("shell GET", err);
    return NextResponse.json({ error: "Failed to load shell data" }, { status: 500 });
  }
}
