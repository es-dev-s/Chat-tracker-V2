"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AvatarMark from "@/components/ui/AvatarMark";
import { roleLabel } from "@/lib/auth/routes";
import { analystColorFor } from "@/lib/design/colors";
import { dicebearSeedForUser } from "@/lib/utils/dicebear";
import { makeDisplayName } from "@/lib/utils/display-name";
import { initialsForPeek, matchUserFromAnalystOrEmail } from "@/lib/utils/user-display";
import type { WorkspaceUser } from "@/lib/workspace/cache";

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Avatar-only analyst cell with premium hover card. */
export default function RecordAnalystPeekCell({
  analyst,
  users,
}: {
  analyst: string;
  users: WorkspaceUser[];
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const showT = useRef(0);
  const hideT = useRef(0);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const analystLabel = (analyst || "—").trim() || "—";
  const peekUser = matchUserFromAnalystOrEmail(analyst || "", users);
  const analystDisplay = peekUser ? makeDisplayName(peekUser) : analystLabel;
  const analystInitials = initialsForPeek(analystDisplay);
  const analystTint = analystColorFor(analyst || "");

  const clearTimers = useCallback(() => {
    globalThis.clearTimeout(showT.current);
    globalThis.clearTimeout(hideT.current);
  }, []);

  const requestHide = useCallback(() => {
    clearTimers();
    hideT.current = window.setTimeout(() => {
      setOpen(false);
      setEntered(false);
    }, prefersReducedMotion() ? 0 : 280);
  }, [clearTimers]);

  const requestShow = useCallback(() => {
    clearTimers();
    showT.current = window.setTimeout(() => {
      setOpen(true);
      setEntered(false);
    }, prefersReducedMotion() ? 0 : 140);
  }, [clearTimers]);

  const layoutCard = useCallback(() => {
    const el = wrapRef.current;
    if (!el || !cardRef.current) return;
    const anchor = el.getBoundingClientRect();
    const cardW = cardRef.current.offsetWidth;
    const cardH = cardRef.current.offsetHeight;
    const pad = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = anchor.right + pad;
    if (left + cardW > vw - pad) left = anchor.left - cardW - pad;
    if (left < pad) left = pad;

    let top = anchor.top + anchor.height / 2 - cardH / 2;
    if (top + cardH > vh - pad) top = vh - pad - cardH;
    if (top < pad) top = pad;

    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => {
      layoutCard();
      requestAnimationFrame(() => setEntered(true));
    });

    window.addEventListener("scroll", layoutCard, true);
    window.addEventListener("resize", layoutCard);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("scroll", layoutCard, true);
      window.removeEventListener("resize", layoutCard);
    };
  }, [open, layoutCard]);

  useLayoutEffect(() => {
    if (!open || !entered) return;
    layoutCard();
  }, [open, entered, analystDisplay, peekUser?.id, layoutCard]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const motionEnd = prefersReducedMotion();

  const card =
    open && typeof document !== "undefined" ? (
      <div
        ref={cardRef}
        className={`ct-record-analyst-card${entered ? " ct-record-analyst-card--visible" : ""}`}
        style={{
          position: "fixed",
          left: coords.left,
          top: coords.top,
          transition: motionEnd ? "none" : undefined,
        }}
        role="tooltip"
        onMouseEnter={() => {
          clearTimers();
          setOpen(true);
        }}
        onMouseLeave={requestHide}
      >
        <div className="ct-record-analyst-card__hero">
          <AvatarMark
            tint={analystTint}
            initials={analystInitials}
            avatarSeed={
              peekUser ? dicebearSeedForUser(peekUser) : analyst || analystLabel
            }
            size={52}
            eager
          />
          <div className="ct-record-analyst-card__hero-meta">
            <div className="ct-record-analyst-card__name">{analystDisplay}</div>
            <div className="ct-record-analyst-card__role">
              {peekUser ? roleLabel(peekUser.role) : "Chat Analyst"}
            </div>
            {peekUser?.email ? (
              <div className="ct-record-analyst-card__email">{peekUser.email}</div>
            ) : null}
          </div>
        </div>
      </div>
    ) : null;

  return (
    <span
      ref={wrapRef}
      className="ct-record-analyst-peek"
      title={analystDisplay !== "—" ? analystDisplay : undefined}
      onMouseEnter={requestShow}
      onMouseLeave={requestHide}
      onFocus={requestShow}
      onBlur={requestHide}
      tabIndex={0}
    >
      <AvatarMark
        tint={analystTint}
        initials={analystInitials}
        avatarSeed={
          peekUser ? dicebearSeedForUser(peekUser) : analyst || analystLabel
        }
        size={26}
      />
      {card ? createPortal(card, document.body) : null}
    </span>
  );
}
