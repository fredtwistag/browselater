"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 2px progress bar that tracks the scroll of its closest scrollable ancestor.
 * Place inside the scrollable pane.
 */
export function ScrollProgress() {
  const [pct, setPct] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let scroller: HTMLElement | null = el.parentElement;
    while (scroller && scroller !== document.body) {
      const style = getComputedStyle(scroller);
      if (/(auto|scroll)/.test(style.overflowY)) break;
      scroller = scroller.parentElement;
    }
    if (!scroller) return;

    function update() {
      if (!scroller) return;
      const max = scroller.scrollHeight - scroller.clientHeight;
      const next = max <= 0 ? 0 : Math.min(1, Math.max(0, scroller.scrollTop / max));
      setPct(next);
    }
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      scroller?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none sticky top-[44px] z-[15] h-[2px] w-full overflow-hidden bg-transparent"
      aria-hidden
    >
      <div
        className="h-full bg-primary/70 transition-[width] duration-150"
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}
