import {
  bearerFromAuthHeader,
  getTokenFromCookies,
  resolveViewerFromToken,
} from "@/lib/auth/session-server";
import { invalidateServerCachePrefix } from "@/lib/workspace/server-cache";

export async function resolveApiViewer(request: Request) {
  const cookieToken = await getTokenFromCookies();
  const headerToken = bearerFromAuthHeader(request.headers.get("authorization"));
  return resolveViewerFromToken(headerToken || cookieToken);
}

export function bustWorkspaceCache(viewerId: string | number): void {
  invalidateServerCachePrefix(`ws:${String(viewerId)}:`);
  invalidateServerCachePrefix("ws:shared:");
}
