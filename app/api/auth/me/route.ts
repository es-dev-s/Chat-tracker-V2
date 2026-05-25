import { NextResponse } from "next/server";
import {
  bearerFromAuthHeader,
  getTokenFromCookies,
  resolveViewerFromToken,
} from "@/lib/auth/session-server";
import { makeDisplayName } from "@/lib/utils/display-name";

export async function GET(request: Request) {
  try {
    const cookieToken = await getTokenFromCookies();
    const headerToken = bearerFromAuthHeader(request.headers.get("authorization"));
    const token = headerToken || cookieToken;
    const viewer = await resolveViewerFromToken(token);

    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        ...viewer,
        name: makeDisplayName(viewer),
      },
    });
  } catch (err) {
    console.error("me error", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
