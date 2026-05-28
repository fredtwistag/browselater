"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { archiveItem } from "@/app/(app)/item/[id]/actions";

/**
 * Feed-only keyboard navigation: j/k to move focus between cards, o to open,
 * e to archive the focused card. Each card has data-feed-card="ITEM_ID".
 */
export function FeedShortcuts() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const indexRef = useRef<number>(-1);

  const getCards = useCallback(
    () => Array.from(document.querySelectorAll<HTMLElement>("[data-feed-card]")),
    [],
  );

  const focusIndex = useCallback(
    (i: number) => {
      const cards = getCards();
      if (cards.length === 0) return;
      const next = Math.max(0, Math.min(cards.length - 1, i));
      indexRef.current = next;
      cards[next].focus();
      cards[next].scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [getCards],
  );

  useEffect(() => {
    function isTyping(e: KeyboardEvent): boolean {
      const t = e.target as HTMLElement | null;
      if (!t) return false;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return true;
      return !!t.isContentEditable;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e)) return;

      const cards = getCards();
      if (cards.length === 0) return;

      if (e.key === "j") {
        e.preventDefault();
        focusIndex(indexRef.current < 0 ? 0 : indexRef.current + 1);
        return;
      }
      if (e.key === "k") {
        e.preventDefault();
        focusIndex(indexRef.current < 0 ? 0 : indexRef.current - 1);
        return;
      }

      const current = cards[indexRef.current];
      if (!current) return;
      const itemId = current.dataset.feedCard;
      if (!itemId) return;

      if (e.key === "o" || e.key === "Enter") {
        e.preventDefault();
        const href = current.getAttribute("href");
        if (href) router.push(href);
        return;
      }
      if (e.key === "e") {
        e.preventDefault();
        startTransition(async () => {
          await archiveItem(itemId);
          toast({ title: "Archived" });
          // Reset to a safe index after the list re-renders.
          indexRef.current = Math.max(0, indexRef.current - 1);
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusIndex, getCards, router]);

  return null;
}
