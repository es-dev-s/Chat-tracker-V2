"use client";

import AvatarMark from "@/components/ui/AvatarMark";
import { analystColorFor } from "@/lib/design/colors";
import { dicebearSeedForUser } from "@/lib/utils/dicebear";
import {
  initialsForPeek,
  matchUserFromAnalystOrEmail,
} from "@/lib/utils/user-display";
import type { WorkspaceUser } from "@/lib/workspace/cache";

export default function AnalystAvatarCell({
  analyst,
  users,
  showName = false,
}: {
  analyst: string;
  users: WorkspaceUser[];
  showName?: boolean;
}) {
  const label = (analyst || "—").trim();
  const peekUser = matchUserFromAnalystOrEmail(analyst || "", users);
  const display = peekUser?.name || label;

  if (!showName) {
    return (
      <AvatarMark
        tint={analystColorFor(analyst || "")}
        initials={initialsForPeek(display || "—")}
        avatarSeed={peekUser ? dicebearSeedForUser(peekUser) : undefined}
        size={26}
      />
    );
  }

  return (
    <span className="ct-notes-analyst-cell">
      <AvatarMark
        tint={analystColorFor(analyst || "")}
        initials={initialsForPeek(display || "—")}
        avatarSeed={peekUser ? dicebearSeedForUser(peekUser) : undefined}
        size={26}
      />
      <span className="ct-notes-analyst-cell__name">{display || "—"}</span>
    </span>
  );
}
