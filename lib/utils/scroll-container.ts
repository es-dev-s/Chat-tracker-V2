const SCROLL_ROOT_SELECTOR = ".ct-page-shell";

export function getPageScrollRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(SCROLL_ROOT_SELECTOR);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scroll the main page shell so `element` sits below the top edge (with offset). */
export function scrollContainerToElement(
  element: HTMLElement,
  options?: { offset?: number; behavior?: ScrollBehavior },
): void {
  const offset = options?.offset ?? 12;
  const behavior =
    options?.behavior ?? (prefersReducedMotion() ? "auto" : "smooth");
  const root = getPageScrollRoot();

  if (!root) {
    element.scrollIntoView({ behavior, block: "start" });
    return;
  }

  const rootRect = root.getBoundingClientRect();
  const elRect = element.getBoundingClientRect();
  const targetTop = root.scrollTop + (elRect.top - rootRect.top) - offset;
  root.scrollTo({ top: Math.max(0, targetTop), behavior });
}

/** Wait until `getElement` returns a connected node (layout settled). */
export function waitForElement(
  getElement: () => HTMLElement | null,
  maxFrames = 24,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    let frames = 0;
    const tick = () => {
      const el = getElement();
      if (el?.isConnected) {
        resolve(el);
        return;
      }
      frames += 1;
      if (frames >= maxFrames) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** Double rAF — run after React commit + browser layout. */
export function afterLayout(callback: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
}
