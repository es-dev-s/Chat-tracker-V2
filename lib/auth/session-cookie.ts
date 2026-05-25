/** Cookie options shared by login / logout routes. */
export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

const WEEK_SECONDS = 60 * 60 * 24 * 7;

/**
 * Whether the session cookie should use the Secure flag.
 * - CHATTRACKER_SESSION_SECURE=true|false overrides auto-detection
 * - Otherwise: secure when the incoming request is HTTPS (or behind HTTPS proxy)
 *
 * Important for self-hosted LAN: `npm run start` sets NODE_ENV=production but you
 * often serve over plain HTTP (http://192.168.x.x). Secure cookies are dropped
 * by browsers on HTTP, which breaks login from other devices.
 */
export function sessionCookieSecure(request?: Request): boolean {
  const forced = process.env.CHATTRACKER_SESSION_SECURE?.trim().toLowerCase();
  if (forced === "true") return true;
  if (forced === "false") return false;

  if (request) {
    const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (forwarded) return forwarded === "https";
    try {
      return new URL(request.url).protocol === "https:";
    } catch {
      // fall through
    }
  }

  return process.env.NODE_ENV === "production";
}

export function buildSessionCookieOptions(
  request: Request,
  maxAge = WEEK_SECONDS,
): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(request),
    path: "/",
    maxAge,
  };
}
