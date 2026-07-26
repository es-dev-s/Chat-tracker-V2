/** Authenticated image URL for a stored chat screenshot path. */
export function chatScreenshotSrc(path: string | null | undefined): string {
  const p = String(path ?? "").trim();
  if (!p) return "";
  return `/api/uploads/chat-screenshot?path=${encodeURIComponent(p)}`;
}
