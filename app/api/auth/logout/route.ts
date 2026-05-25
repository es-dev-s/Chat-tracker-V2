import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { absoluteAppUrl } from "@/lib/auth/request-origin";
import { buildSessionCookieOptions } from "@/lib/auth/session-cookie";
import { ROUTES } from "@/lib/auth/routes";

function logoutRedirect(request: Request) {
  const response = NextResponse.redirect(absoluteAppUrl(request, ROUTES.login));
  response.cookies.set(SESSION_COOKIE, "", { ...buildSessionCookieOptions(request), maxAge: 0 });
  return response;
}

/** Browser logout — clears session cookie and sends user to login. */
export async function POST(request: Request) {
  return logoutRedirect(request);
}
