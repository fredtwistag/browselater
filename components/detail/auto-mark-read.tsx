"use client";

import { useEffect } from "react";
import { markRead } from "@/app/(app)/item/[id]/actions";

interface AutoMarkReadProps {
  itemId: string;
  alreadyRead: boolean;
  delayMs?: number;
}

/**
 * Sets items.read_at after `delayMs` of dwell on the reader pane.
 * Skips if already read. Cleanup cancels the timer (so quickly switching
 * between rows doesn't mark unread items as read).
 */
export function AutoMarkRead({ itemId, alreadyRead, delayMs = 1500 }: AutoMarkReadProps) {
  useEffect(() => {
    if (alreadyRead) return;
    const t = setTimeout(() => {
      void markRead(itemId);
    }, delayMs);
    return () => clearTimeout(t);
  }, [itemId, alreadyRead, delayMs]);
  return null;
}
