import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { ROUTES } from "@/lib/auth/routes";

function logoutRedirect(request: Request) {
  const response = NextResponse.redirect(new URL(ROUTES.login, request.url));
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

/** Browser logout — clears session cookie and sends user to login. */
export async function POST(request: Request) {
  return logoutRedirect(request);
}
