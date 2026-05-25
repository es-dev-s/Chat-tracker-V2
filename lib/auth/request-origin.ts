const LOOPBACK_HOSTS = new Set(["0.0.0.0", "[::]", "::", "127.0.0.1", "localhost"]);

/**
 * Public origin for redirects — uses the Host the browser actually opened,
 * not the server bind address (0.0.0.0) from `request.url`.
 */
export function requestPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const hostHeader = request.headers.get("host")?.trim();
  const host = forwardedHost || hostHeader;

  let protocol = forwardedProto?.replace(/:$/, "") || "";
  if (!protocol) {
    try {
      protocol = new URL(request.url).protocol.replace(/:$/, "");
    } catch {
      protocol = "http";
    }
  }

  if (host) {
    return `${protocol}://${host}`;
  }

  try {
    const url = new URL(request.url);
    if (LOOPBACK_HOSTS.has(url.hostname)) {
      url.hostname = "localhost";
    }
    return url.origin;
  } catch {
    return "http://localhost:5666";
  }
}

/** Build an absolute app URL for redirects (login, dashboard, etc.). */
export function absoluteAppUrl(request: Request, pathname: string): URL {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, `${requestPublicOrigin(request)}/`);
}
