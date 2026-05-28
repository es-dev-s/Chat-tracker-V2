import { NextResponse } from "next/server";

export function mapWriteError(err: unknown): NextResponse {
  const code = err instanceof Error ? err.message : String(err);
  if (
    code === "RECORD_OUT_OF_SCOPE" ||
    code === "USER_OUT_OF_SCOPE" ||
    code === "USER_CREATE_OUT_OF_SCOPE" ||
    code === "FIELD_FORBIDDEN"
  ) {
    return NextResponse.json({ error: code }, { status: 403 });
  }
  if (
    code === "USERS_FORBIDDEN" ||
    code === "TEAMS_FORBIDDEN" ||
    code === "FORBIDDEN_TEAM_NAME" ||
    code === "PROFILES_FORBIDDEN"
  ) {
    return NextResponse.json({ error: code }, { status: 403 });
  }
  if (
    code === "BODY_EMPTY_SNAPSHOT_REJECTED" ||
    code === "BODY_EMPTY_USERS_REJECTED" ||
    code === "USERS_TEAMLEAD_STATE" ||
    code === "TEAMS_TEAMLEAD_STATE" ||
    code === "ID_MISMATCH" ||
    code === "TEAM_NOT_IN_CATALOG" ||
    code === "OUTCOME_FIELDS_INVALID" ||
    code === "OUTCOME_ORDER_INVALID" ||
    code === "TIME_ORDER_INVALID_FIRST_REPLY" ||
    code === "TIME_ORDER_INVALID_CLIENT_LAST_REPLY" ||
    code === "TIME_ORDER_INVALID_ANALYST_LAST"
  ) {
    return NextResponse.json({ error: code }, { status: 400 });
  }
  if (
    code === "TEAM_NAME_REQUIRED" ||
    code === "TEAM_NAME_CONFLICT_CASE" ||
    code === "PROFILE_NAME_REQUIRED" ||
    code === "USER_EMAIL_CONFLICT" ||
    code === "USER_EMAIL_REQUIRED"
  ) {
    return NextResponse.json({ error: code }, { status: 400 });
  }
  if (code === "DUPLICATE_ID_IN_SYNC_PAYLOAD" || code === "DUPLICATE_TEAM_IN_SYNC_PAYLOAD") {
    return NextResponse.json({ error: code }, { status: 400 });
  }
  console.error("write error", err);
  return NextResponse.json({ error: "Write failed" }, { status: 500 });
}
