import { randomUUID } from "node:crypto";
import { withSupabaseFailover } from "./supabase";

export const CHAT_SCREENSHOT_BUCKET = "chat-screenshots";
export const CHAT_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const CHAT_SCREENSHOT_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const SAFE_PATH =
  /^[a-zA-Z0-9]+\/[a-zA-Z0-9]+\/(first|last)-[a-f0-9-]{36}\.(jpe?g|png|webp|gif)$/i;

export type ChatScreenshotKind = "first" | "last";

export function isSafeChatScreenshotPath(path: string): boolean {
  const p = String(path ?? "").trim();
  return !!p && SAFE_PATH.test(p) && !p.includes("..");
}

function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

async function ensureBucket(): Promise<void> {
  await withSupabaseFailover(async (sb) => {
    const listed = await sb.storage.listBuckets();
    if (listed.error) throw new Error(`list buckets: ${listed.error.message}`);
    const exists = (listed.data || []).some((b) => b.name === CHAT_SCREENSHOT_BUCKET);
    if (exists) return null;
    const created = await sb.storage.createBucket(CHAT_SCREENSHOT_BUCKET, {
      public: false,
      fileSizeLimit: CHAT_SCREENSHOT_MAX_BYTES,
      allowedMimeTypes: [...CHAT_SCREENSHOT_MIME],
    });
    if (created.error && !/already exists/i.test(created.error.message)) {
      throw new Error(`create bucket: ${created.error.message}`);
    }
    return null;
  });
}

export async function uploadChatScreenshotObject(options: {
  viewerId: string | number;
  kind: ChatScreenshotKind;
  bytes: Uint8Array;
  contentType: string;
}): Promise<string> {
  const mime = String(options.contentType || "").toLowerCase().split(";")[0].trim();
  if (!CHAT_SCREENSHOT_MIME.has(mime)) {
    throw new Error("SCREENSHOT_MIME_INVALID");
  }
  if (options.bytes.byteLength <= 0 || options.bytes.byteLength > CHAT_SCREENSHOT_MAX_BYTES) {
    throw new Error("SCREENSHOT_SIZE_INVALID");
  }

  await ensureBucket();

  const userKey = String(options.viewerId).replace(/[^a-zA-Z0-9]/g, "") || "user";
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const objectPath = `${userKey}/${day}/${options.kind}-${randomUUID()}.${extForMime(mime)}`;

  await withSupabaseFailover(async (sb) => {
    const res = await sb.storage.from(CHAT_SCREENSHOT_BUCKET).upload(objectPath, options.bytes, {
      contentType: mime,
      upsert: false,
    });
    if (res.error) throw new Error(`upload screenshot: ${res.error.message}`);
    return null;
  });

  return objectPath;
}

export async function downloadChatScreenshotObject(objectPath: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> {
  if (!isSafeChatScreenshotPath(objectPath)) {
    throw new Error("SCREENSHOT_PATH_INVALID");
  }

  return withSupabaseFailover(async (sb) => {
    const res = await sb.storage.from(CHAT_SCREENSHOT_BUCKET).download(objectPath);
    if (res.error || !res.data) {
      throw new Error(
        `download chat screenshot: ${res.error?.message || "object missing"}`,
      );
    }
    const blob = res.data;
    const buf = new Uint8Array(await blob.arrayBuffer());
    const contentType =
      blob.type && CHAT_SCREENSHOT_MIME.has(blob.type) ? blob.type : "application/octet-stream";
    return { bytes: buf, contentType };
  });
}
