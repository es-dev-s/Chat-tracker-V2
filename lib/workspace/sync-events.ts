/** Client-only: request a background workspace sync after local mutations. */
export const WORKSPACE_SYNC_EVENT = "ct:workspace-sync";

export function requestWorkspaceSync(forceFull = false): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_SYNC_EVENT, { detail: { forceFull } }),
  );
}
