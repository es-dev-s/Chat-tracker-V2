import { NextResponse } from "next/server";
import {
  bearerFromAuthHeader,
  getTokenFromCookies,
  resolveViewerFromToken,
} from "@/lib/auth/session-server";
import {
  hydrateSessionUser,
  loadWorkspaceBootstrap,
  loadWorkspaceData,
  loadWorkspaceVersion,
} from "@/lib/workspace/load-workspace";
import { WORKSPACE_BOOTSTRAP_RECORD_LIMIT } from "@/lib/workspace/constants";

async function resolveViewer(request: Request) {
  const cookieToken = await getTokenFromCookies();
  const headerToken = bearerFromAuthHeader(request.headers.get("authorization"));
  return resolveViewerFromToken(headerToken || cookieToken);
}

export async function GET(request: Request) {
  try {
    const viewer = await resolveViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const hydrated = hydrateSessionUser(viewer);
    const url = new URL(request.url);
    const fresh = url.searchParams.get("fresh") === "1";
    const loadOpts = fresh ? { fresh: true as const } : undefined;
    const mode = url.searchParams.get("mode");
    const clientVersion =
      url.searchParams.get("version") ||
      request.headers.get("if-none-match")?.replace(/^"|"$/g, "");

    if (mode === "version") {
      const payload = await loadWorkspaceVersion(hydrated, loadOpts);
      if (clientVersion && clientVersion === payload.version) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            ETag: `"${payload.version}"`,
            "X-Workspace-Version": payload.version,
            "Cache-Control": "private, no-store, max-age=0",
          },
        });
      }
      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          ETag: `"${payload.version}"`,
          "X-Workspace-Version": payload.version,
        },
      });
    }

    const bootstrap = url.searchParams.get("bootstrap") === "1";
    if (bootstrap) {
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam
        ? Math.min(500, Math.max(1, parseInt(limitParam, 10) || WORKSPACE_BOOTSTRAP_RECORD_LIMIT))
        : WORKSPACE_BOOTSTRAP_RECORD_LIMIT;
      const payload = await loadWorkspaceBootstrap(hydrated, limit, loadOpts);
      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          ETag: `"${payload.version}"`,
          "X-Workspace-Version": payload.version,
          "X-Workspace-Bootstrap": "1",
        },
      });
    }

    const payload = await loadWorkspaceData(hydrated, loadOpts);
    if (clientVersion && clientVersion === payload.version) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: `"${payload.version}"`,
          "X-Workspace-Version": payload.version,
          "Cache-Control": "private, no-store, max-age=0",
        },
      });
    }

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        ETag: `"${payload.version}"`,
        "X-Workspace-Version": payload.version,
      },
    });
  } catch (err) {
    console.error("workspace GET", err);
    return NextResponse.json({ error: "Failed to load workspace" }, { status: 500 });
  }
}
