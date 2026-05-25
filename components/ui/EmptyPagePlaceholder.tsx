"use client";

import { C, RAD } from "@/lib/design/tokens";
import { useWorkspaceStore } from "@/store/workspace-store";

export default function EmptyPagePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const recordCount = useWorkspaceStore((s) => s.records.length);
  const ready = useWorkspaceStore((s) => s.ready);

  return (
    <div className="ct-empty-page">
      <h1 className="ct-empty-page-title">{title}</h1>
      <p className="ct-empty-page-desc">
        {description ??
          "This section is being rebuilt in the new architecture. Content will appear here soon."}
      </p>
      <p className="ct-empty-page-meta">
        <span className="ct-scope-badge">
          {ready
            ? `${recordCount.toLocaleString()} record${recordCount === 1 ? "" : "s"} in your scope`
            : "Loading records…"}
        </span>
      </p>
    </div>
  );
}
