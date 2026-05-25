"use client";

import type { ReactNode } from "react";
import AvatarMark from "@/components/ui/AvatarMark";
import { dicebearSeedForUser } from "@/lib/utils/dicebear";
import { initialsForPeek } from "@/lib/utils/user-display";
import type { WorkspaceUser } from "@/lib/workspace/cache";

type UserPeekNameRowProps = {
  tint: string;
  peekUser: Partial<WorkspaceUser>;
  labelFallback?: string;
  children?: ReactNode;
};

/** Name row with avatar — peek disabled (admin table). */
export default function UserPeekNameRow({
  tint,
  peekUser,
  labelFallback,
  children,
}: UserPeekNameRowProps) {
  const displayName = (peekUser?.name || labelFallback || "").trim();
  const initials = initialsForPeek(displayName);
  const avatarSeed = dicebearSeedForUser(peekUser);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        verticalAlign: "middle",
      }}
    >
      <AvatarMark tint={tint} initials={initials} avatarSeed={avatarSeed} size={26} />
      {children != null ? <span style={{ minWidth: 0 }}>{children}</span> : null}
    </span>
  );
}
