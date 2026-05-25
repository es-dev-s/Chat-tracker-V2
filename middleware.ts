import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { ROUTES } from "@/lib/auth/routes";

const PUBLIC_PATHS = new Set([ROUTES.login, "/"]);
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/log",
  "/records",
  "/notes",
  "/admin",
  "/leads",
  "/lead-notes",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function withPathname(response: NextResponse, pathname: string): NextResponse {
  response.headers.set("x-pathname", pathname);
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const hasSession = Boolean(token?.trim());

  if (pathname === ROUTES.login && hasSession) {
    return withPathname(
      NextResponse.redirect(new URL(ROUTES.dashboard, request.url)),
      pathname,
    );
  }

  if (isProtectedPath(pathname) && !hasSession) {
    const loginUrl = new URL(ROUTES.login, request.url);
    loginUrl.searchParams.set("next", pathname);
    return withPathname(NextResponse.redirect(loginUrl), pathname);
  }

  if (pathname === "/" && hasSession) {
    return withPathname(
      NextResponse.redirect(new URL(ROUTES.dashboard, request.url)),
      pathname,
    );
  }

  if (pathname === "/" && !hasSession) {
    return withPathname(
      NextResponse.redirect(new URL(ROUTES.login, request.url)),
      pathname,
    );
  }

  return withPathname(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    "/log/:path*",
    "/records/:path*",
    "/notes/:path*",
    "/admin/:path*",
    "/leads/:path*",
    "/lead-notes/:path*",
  ],
};
