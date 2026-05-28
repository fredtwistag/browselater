"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global keyboard shortcuts (PRD §13.3 §3.7).
 *   /  focus search
 *   n  focus save input
 *   g f → /feed
 *   g c → /chat
 *   g s → /search
 * Skips when the user is typing in an input/textarea/contenteditable.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  useEffect(() => {
    let leader: "g" | null = null;
    let leaderTimer: ReturnType<typeof setTimeout> | null = null;

    function isTyping(e: KeyboardEvent): boolean {
      const t = e.target as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (t.isContentEditable) return true;
      return false;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e)) return;

      if (leader === "g") {
        if (e.key === "f") {
          router.push("/feed");
        } else if (e.key === "c") {
          router.push("/chat");
        } else if (e.key === "s") {
          router.push("/search");
        }
        leader = null;
        if (leaderTimer) clearTimeout(leaderTimer);
        return;
      }

      if (e.key === "g") {
        leader = "g";
        if (leaderTimer) clearTimeout(leaderTimer);
        leaderTimer = setTimeout(() => (leader = null), 1200);
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        router.push("/search");
      }
      if (e.key === "n") {
        e.preventDefault();
        router.push("/feed");
        // Focus is handled by the page on next render; users land at the save input.
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (leaderTimer) clearTimeout(leaderTimer);
    };
  }, [router]);

  return null;
}
