import { cookies } from "next/headers";
import { verifySessionToken } from "./token";
import { SESSION_COOKIE } from "./constants";
import { normEmail, readUserBySession, stripPassword } from "../db/users";
import type { SessionUser } from "./constants";

export { SESSION_COOKIE, SESSION_KEY } from "./constants";
export type { SessionUser } from "./constants";

export async function getTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return token?.trim() ? token.trim() : null;
}

export async function resolveViewerFromToken(
  token: string | null | undefined,
): Promise<SessionUser | null> {
  const claims = verifySessionToken(token);
  if (!claims) return null;
  const user = await readUserBySession(claims.userId, claims.email);
  return user ? stripPassword(user) : null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getTokenFromCookies();
  return resolveViewerFromToken(token);
}

export function bearerFromAuthHeader(
  authHeader: string | null | undefined,
): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return m?.[1]?.trim() || null;
}
