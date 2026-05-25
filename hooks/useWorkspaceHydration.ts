"use client";

import { useWorkspaceStore } from "@/store/workspace-store";

export function useWorkspaceHydration() {
  const ready = useWorkspaceStore((s) => s.ready);
  return {
    ready,
    showSkeleton: !ready,
  };
}
