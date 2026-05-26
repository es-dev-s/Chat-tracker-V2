import type { ChatRecord } from "@/lib/db/records";
import { requestWorkspaceSync } from "@/lib/workspace/sync-events";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

async function parseApiError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return String(body?.error || `Request failed (${res.status})`);
  } catch {
    return `Request failed (${res.status})`;
  }
}

/** Reconcile with DB immediately after writes — bypasses stale server/client caches. */
function scheduleWorkspaceRefresh(forceFull = true): void {
  requestWorkspaceSync(forceFull, true);
}

export async function refreshWorkspaceAfterMutation(): Promise<boolean> {
  scheduleWorkspaceRefresh(true);
  return true;
}

export async function postChatRecord(
  record: Omit<ChatRecord, "id"> | Record<string, unknown>,
): Promise<ChatRecord> {
  const res = await fetch("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ record }),
  });
  if (res.status === 401 || res.status === 403) {
    void useAuthStore.getState().logout();
    throw new Error("Session expired.");
  }
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = await res.json();
  const saved = data.record as ChatRecord;
  useWorkspaceStore.getState().patchRecord(saved);
  scheduleWorkspaceRefresh();
  return saved;
}

export async function patchChatRecord(record: ChatRecord | Record<string, unknown>): Promise<ChatRecord> {
  const id = Number((record as ChatRecord).id);
  const res = await fetch(`/api/records/${encodeURIComponent(String(id))}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ record }),
  });
  if (res.status === 401 || res.status === 403) {
    void useAuthStore.getState().logout();
    throw new Error("Session expired.");
  }
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = await res.json();
  const saved = data.record as ChatRecord;
  useWorkspaceStore.getState().patchRecord(saved);
  scheduleWorkspaceRefresh();
  return saved;
}

export async function deleteChatRecord(id: number): Promise<void> {
  const prevRecords = useWorkspaceStore.getState().records;
  useWorkspaceStore.getState().removeRecord(id);
  const res = await fetch(`/api/records/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 401 || res.status === 403) {
    useWorkspaceStore.setState({
      records: prevRecords,
      localRevision: Math.max(0, useWorkspaceStore.getState().localRevision - 1),
    });
    void useAuthStore.getState().logout();
    throw new Error("Session expired.");
  }
  if (!res.ok) {
    useWorkspaceStore.setState({
      records: prevRecords,
      localRevision: Math.max(0, useWorkspaceStore.getState().localRevision - 1),
    });
    throw new Error(await parseApiError(res));
  }
  scheduleWorkspaceRefresh();
}

export async function createUser(user: Record<string, unknown>, role: "analyst" | "mainTeamLead" = "analyst") {
  const url = role === "mainTeamLead" ? "/api/users/main-team-lead" : "/api/users";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ user }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = await res.json();
  scheduleWorkspaceRefresh(true);
  return data.user;
}

export async function patchUser(userId: string | number, user: Record<string, unknown>) {
  const res = await fetch(`/api/users/${encodeURIComponent(String(userId))}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ user }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = await res.json();
  scheduleWorkspaceRefresh(true);
  return data.user;
}

export async function deleteUser(userId: string | number) {
  const res = await fetch(`/api/users/${encodeURIComponent(String(userId))}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  scheduleWorkspaceRefresh(true);
}

export async function addTeam(name: string) {
  const res = await fetch("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  scheduleWorkspaceRefresh(true);
}

export async function deleteTeam(name: string) {
  const res = await fetch(`/api/teams/${encodeURIComponent(name)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  scheduleWorkspaceRefresh(true);
}

export async function addProfile(name: string) {
  const res = await fetch("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  scheduleWorkspaceRefresh(true);
}

export async function deleteProfile(name: string) {
  const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  scheduleWorkspaceRefresh(true);
}
