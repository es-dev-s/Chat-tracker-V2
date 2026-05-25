import { Loader2 } from "lucide-react";

/** Inline spinner for buttons and compact loading states. */
export default function BusySpinner({ size = 14 }: { size?: number }) {
  return (
    <Loader2
      size={size}
      strokeWidth={2.25}
      aria-hidden
      className="ct-busy-spinner"
    />
  );
}

/** Label + spinner row for primary/ghost buttons. */
export function BusyLabel({
  label,
  size = 14,
}: {
  label: string;
  size?: number;
}) {
  return (
    <span className="ct-btn-busy">
      <BusySpinner size={size} />
      {label}
    </span>
  );
}
