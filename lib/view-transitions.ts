/**
 * Tiny wrapper around the browser View Transitions API.
 *
 * Used to morph a feed-card image/title into the detail-page header during
 * client-side navigation. Falls back to a normal navigation if the API or
 * matching DOM elements aren't available, or if the user prefers reduced motion.
 */

export function startViewTransition(callback: () => void): void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // `document.startViewTransition` ships in TS lib.dom as of TS 5.5, but it's
  // still unsupported in Firefox/Safari at time of writing — feature-detect.
  if (reduce || typeof document.startViewTransition !== "function") {
    callback();
    return;
  }
  document.startViewTransition(callback);
}

export const itemViewTransitionName = (itemId: string, slot: "image" | "title") =>
  `bl-${slot}-${itemId.slice(0, 8)}`;
