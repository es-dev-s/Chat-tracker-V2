/** Copy via execCommand — must run synchronously inside a user gesture (click). */
function copyViaExecCommand(value: string): boolean {
  if (typeof document === "undefined") return false;

  const attempts: Array<() => boolean> = [
    () => {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("aria-hidden", "true");
      ta.style.cssText =
        "position:fixed;top:0;left:0;width:2px;height:2px;padding:0;margin:0;border:none;outline:none;box-shadow:none;background:transparent;opacity:0;z-index:-1;";
      document.body.appendChild(ta);
      ta.focus({ preventScroll: true });
      ta.select();
      ta.setSelectionRange(0, value.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    },
    () => {
      const span = document.createElement("span");
      span.textContent = value;
      span.style.cssText =
        "position:fixed;top:0;left:0;opacity:0;white-space:pre;user-select:all;";
      document.body.appendChild(span);
      const range = document.createRange();
      range.selectNodeContents(span);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      const ok = document.execCommand("copy");
      selection?.removeAllRanges();
      document.body.removeChild(span);
      return ok;
    },
  ];

  for (const attempt of attempts) {
    try {
      if (attempt()) return true;
    } catch {
      // try next strategy
    }
  }
  return false;
}

/** Synchronous copy — call directly from click handlers to preserve user activation. */
export function copyTextToClipboardSync(text: string): boolean {
  const value = typeof text === "string" ? text : String(text ?? "");
  if (!value) return false;
  return copyViaExecCommand(value);
}

/**
 * Copy text to the system clipboard.
 * Works on HTTPS, localhost, and plain HTTP (LAN / self-hosted Linux).
 * Tries a synchronous execCommand path first so copy survives async boundaries
 * from click handlers on non-secure origins.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = typeof text === "string" ? text : String(text ?? "");
  if (!value) return false;

  if (copyViaExecCommand(value)) return true;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Clipboard API blocked — retry execCommand once more.
    }
  }

  return copyViaExecCommand(value);
}

/** Prefer sync copy in click handlers; fall back to async Clipboard API. */
export async function copyTextToClipboardFromClick(text: string): Promise<boolean> {
  if (copyTextToClipboardSync(text)) return true;
  return copyTextToClipboard(text);
}
