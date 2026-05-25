import { NextResponse } from "next/server";
import { bustWorkspaceCache, resolveApiViewer } from "@/lib/api/resolve-viewer";
import { notifUserKey } from "@/lib/auth/scoping";
import { readDismissedNotifsForUser, writeDismissedNotifs } from "@/lib/db/dismissed-notifs";

export async function GET(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const vk = notifUserKey(viewer);
    const ids = await readDismissedNotifsForUser(vk);
    return NextResponse.json({ value: { [vk]: ids } });
  } catch (err) {
    console.error("dismissed-notifs GET", err);
    return NextResponse.json(
      { error: "Failed to read dismissed notifications" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const vk = notifUserKey(viewer);
    const body = await request.json().catch(() => ({}));
    const value =
      body?.value && typeof body.value === "object" ? body.value : {};
    const patchIds = value[vk];
    if (!Array.isArray(patchIds)) {
      return NextResponse.json({ ok: true });
    }
    await writeDismissedNotifs({ [vk]: patchIds.map(String) });
    bustWorkspaceCache(viewer.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("dismissed-notifs PUT", err);
    return NextResponse.json(
      { error: "Failed to save dismissed notifications" },
      { status: 500 },
    );
  }
}
