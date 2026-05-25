"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { btn } from "@/lib/design/control-styles";

export default function AnalystNotesPaginationBar({
  total,
  activePage,
  totalPages,
  rangeStart,
  rangeEnd,
  onPrev,
  onNext,
  navLabel,
  placement = "header",
}: {
  total: number;
  activePage: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  onPrev: () => void;
  onNext: () => void;
  navLabel: string;
  /** Renders in the panel header above the table. */
  placement?: "header";
}) {
  const disabledPrev = activePage <= 0 || totalPages === 0;
  const disabledNext = totalPages === 0 || activePage >= totalPages - 1;

  return (
    <nav
      aria-label={navLabel}
      className={`ct-notes-pagination ct-notes-pagination--${placement}`}
    >
      <div className="ct-notes-pagination__summary">
        Showing{" "}
        <strong>
          {rangeStart}-{rangeEnd}
        </strong>{" "}
        of <strong>{total}</strong> notes
      </div>
      <div className="ct-notes-pagination__controls" role="group" aria-label="Pagination controls">
        <button
          type="button"
          className="ct-notes-pagination__btn"
          {...btn("ghost", {
            padding: "7px 12px",
            fontSize: 12.5,
            minHeight: 34,
            gap: 4,
            opacity: disabledPrev ? 0.45 : 1,
            cursor: disabledPrev ? "not-allowed" : "pointer",
          })}
          onClick={onPrev}
          disabled={disabledPrev}
        >
          <ChevronLeft size={15} strokeWidth={2.25} aria-hidden />
          Previous
        </button>
        <span className="ct-notes-pagination__page" aria-live="polite">
          Page {total ? activePage + 1 : 0} of {totalPages || 0}
        </span>
        <button
          type="button"
          className="ct-notes-pagination__btn"
          {...btn("ghost", {
            padding: "7px 12px",
            fontSize: 12.5,
            minHeight: 34,
            gap: 4,
            opacity: disabledNext ? 0.45 : 1,
            cursor: disabledNext ? "not-allowed" : "pointer",
          })}
          onClick={onNext}
          disabled={disabledNext}
        >
          Next
          <ChevronRight size={15} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </nav>
  );
}
