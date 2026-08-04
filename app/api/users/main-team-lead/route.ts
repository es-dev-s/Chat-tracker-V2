import { NextResponse } from "next/server";
import { assertTeamLeadMayUpsertUser } from "@/lib/auth/merge-snapshots";
import { mergeUserFieldsForPatch } from "@/lib/auth/user-patch";
import { viewerMaySeeUserPassword } from "@/lib/auth/user-write";
import { mapWriteError } from "@/lib/api/map-write-error";
import { bustWorkspaceCache, resolveApiViewer } from "@/lib/api/resolve-viewer";
import { readRecords } from "@/lib/db/records";
import { normEmail, normPersonName, readUsers, stripPassword } from "@/lib/db/users";
import { readNextTrackerUserId, upsertTrackerUser } from "@/lib/db/users-write";

export async function POST(request: Request) {
  try {
    const viewer = await resolveApiViewer(request);
    if (!viewer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const body = await request.json().catch(() => null);
    const raw = body?.user;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json({ error: "USER_REQUIRED" }, { status: 400 });
    }
    const allUsers = await readUsers();
    const allRecords = await readRecords();
    const email = normEmail((raw as Record<string, unknown>).email);
    const name = String((raw as Record<string, unknown>).name ?? "").trim();
    if (!name) {
      return NextResponse.json({ error: "USER_NAME_REQUIRED" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "USER_EMAIL_REQUIRED" }, { status: 400 });
    }
    if (allUsers.some((u) => normEmail(u.email) === email)) {
      return NextResponse.json(
        {
          error: "USER_EMAIL_CONFLICT",
          message: "A member with this email already exists.",
        },
        { status: 409 },
      );
    }
    const nameKey = normPersonName(name);
    const nameClash = allUsers.find((u) => normPersonName(u.name) === nameKey);
    if (nameClash) {
      return NextResponse.json(
        {
          error: "USER_NAME_CONFLICT",
          message: `A member named "${nameClash.name}" already exists. Duplicate member names are not allowed.`,
          existingName: nameClash.name,
        },
        { status: 409 },
      );
    }
    const id = await readNextTrackerUserId();
    const nu = mergeUserFieldsForPatch(
      {
        id,
        name: "",
        role: "mainTeamLead",
        email: "",
        password: "",
        teamName: "",
        teamNames: [],
        profileNames: [],
        isAdmin: false,
      },
      raw as Record<string, unknown>,
    );
    nu.id = id;
    nu.name = name;
    nu.role = "mainTeamLead";
    nu.isAdmin = false;
    assertTeamLeadMayUpsertUser(viewer, null, nu, allRecords);
    await upsertTrackerUser(nu);
    bustWorkspaceCache(viewer.id);
    const withSecret = viewerMaySeeUserPassword(viewer, nu, allRecords) ? nu : stripPassword(nu);
    return NextResponse.json({ user: withSecret }, { status: 201 });
  } catch (err) {
    return mapWriteError(err);
  }
}
