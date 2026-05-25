import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/auth/schemas";
import { signSessionToken } from "@/lib/auth/token";
import { SESSION_COOKIE, SESSION_KEY } from "@/lib/auth/constants";
import { normEmail, readUserByEmail, stripPassword } from "@/lib/db/users";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "EMAIL_PASSWORD_REQUIRED" }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "EMAIL_PASSWORD_REQUIRED" }, { status: 400 });
    }

    const email = normEmail(parsed.data.email);
    const password = parsed.data.password.trim();

    const user = await readUserByEmail(email);
    if (!user || String(user.password ?? "") !== password) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }

    let sessionToken: string;
    try {
      sessionToken = signSessionToken({ userId: user.id, email: user.email });
    } catch {
      return NextResponse.json({ error: "SERVER_AUTH_CONFIG" }, { status: 503 });
    }
    const safeUser = stripPassword(user);

    const response = NextResponse.json({ token: sessionToken, user: safeUser });
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    // Mirror legacy localStorage shape for client-side compatibility
    response.headers.set(
      "X-Session-Payload",
      JSON.stringify({
        key: SESSION_KEY,
        value: {
          email: safeUser.email,
          userId: safeUser.id,
          token: sessionToken,
          isAdmin: safeUser.isAdmin === true,
        },
      }),
    );

    return response;
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
