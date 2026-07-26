import { NextResponse } from "next/server";
import { resolveApiViewer } from "@/lib/api/resolve-viewer";
import {
  CHAT_SCREENSHOT_MAX_BYTES,
  CHAT_SCREENSHOT_MIME,
  downloadChatScreenshotObject,
  isSafeChatScreenshotPath,
  uploadChatScreenshotObject,
  type ChatScreenshotKind,
} from "@/lib/db/chat-screenshots";

export const runtime = "nodejs";

function parseKind(raw: unknown): ChatScreenshotKind | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "first" || v === "last") return v;
  return null;
}

export async function POST(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (viewer.role !== "analyst" && viewer.role !== "teamLead") {
      return NextResponse.json({ error: "SCREENSHOT_FORBIDDEN" }, { status: 403 });
    }

    const form = await request.formData();
    const kind = parseKind(form.get("kind"));
    const file = form.get("file");
    if (!kind) {
      return NextResponse.json({ error: "SCREENSHOT_KIND_REQUIRED" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "SCREENSHOT_FILE_REQUIRED" }, { status: 400 });
    }

    const mime = String(file.type || "").toLowerCase().split(";")[0].trim();
    if (!CHAT_SCREENSHOT_MIME.has(mime)) {
      return NextResponse.json({ error: "SCREENSHOT_MIME_INVALID" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > CHAT_SCREENSHOT_MAX_BYTES) {
      return NextResponse.json({ error: "SCREENSHOT_SIZE_INVALID" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = await uploadChatScreenshotObject({
      viewerId: viewer.id,
      kind,
      bytes,
      contentType: mime,
    });

    return NextResponse.json({
      path,
      url: `/api/uploads/chat-screenshot?path=${encodeURIComponent(path)}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UPLOAD_FAILED";
    const status =
      msg === "SCREENSHOT_MIME_INVALID" || msg === "SCREENSHOT_SIZE_INVALID" ? 400 : 500;
    console.error("chat-screenshot POST", err);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function GET(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const path = new URL(request.url).searchParams.get("path") || "";
    if (!isSafeChatScreenshotPath(path)) {
      return NextResponse.json({ error: "SCREENSHOT_PATH_INVALID" }, { status: 400 });
    }

    const { bytes, contentType } = await downloadChatScreenshotObject(path);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("chat-screenshot GET", err);
    return NextResponse.json({ error: "SCREENSHOT_NOT_FOUND" }, { status: 404 });
  }
}
