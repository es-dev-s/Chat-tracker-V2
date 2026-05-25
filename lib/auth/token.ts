import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "ct1";

function sessionSecret(): string | null {
  const s = process.env.CHATTRACKER_SESSION_SECRET;
  if (typeof s === "string" && s.trim().length >= 16) return s.trim();
  if (process.env.NODE_ENV !== "production") {
    return "__chattracker_dev_only_min16__";
  }
  return null;
}

export type TokenPayload = { userId: string | number; email: string };
export type VerifiedToken = TokenPayload & { exp: number };

export function signSessionToken(
  payload: TokenPayload,
  ttlSeconds = 60 * 60 * 24 * 7,
): string {
  const secret = sessionSecret();
  if (!secret) {
    throw new Error(
      "Set CHATTRACKER_SESSION_SECRET (min 16 chars) in environment for production API auth.",
    );
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const bodyObj = {
    v: VERSION,
    uid: String(payload.userId ?? ""),
    e: String(payload.email ?? "").trim().toLowerCase(),
    exp,
  };
  const payloadSegment = Buffer.from(JSON.stringify(bodyObj), "utf8").toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret)
    .update(payloadSegment)
    .digest("base64url");
  return `${payloadSegment}.${sig}`;
}

export function verifySessionToken(raw: string | null | undefined): VerifiedToken | null {
  const secret = sessionSecret();
  if (!secret || typeof raw !== "string" || !raw.trim()) return null;
  const s = raw.trim();
  const lastDot = s.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === s.length - 1) return null;
  const payloadSegment = s.slice(0, lastDot);
  const sig = s.slice(lastDot + 1);
  let bodyObj: {
    v?: string;
    e?: string;
    uid?: string;
    exp?: number;
  };
  try {
    bodyObj = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    );
  } catch {
    return null;
  }
  if (
    bodyObj?.v !== VERSION ||
    !bodyObj?.e ||
    bodyObj.uid === undefined ||
    bodyObj.uid === ""
  ) {
    return null;
  }
  const email = String(bodyObj.e).trim().toLowerCase();
  const exp = Number(bodyObj.exp);
  if (!email || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  const expectedSig = createHmac("sha256", secret)
    .update(payloadSegment)
    .digest("base64url");
  try {
    if (
      !timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expectedSig, "utf8"))
    ) {
      return null;
    }
  } catch {
    return null;
  }
  const userIdStr = String(bodyObj.uid);
  return {
    userId: /^-?\d+$/.test(userIdStr) ? Number(userIdStr) : userIdStr,
    email,
    exp,
  };
}
