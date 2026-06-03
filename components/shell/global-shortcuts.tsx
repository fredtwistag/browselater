"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/use-toast";
import { CommandPalette } from "./command-palette";
import { ShortcutHelpDialog } from "./shortcut-help-dialog";
import { registerUndo, runUndoIfPending } from "@/lib/shell/undo";
import {
  archiveItem,
  unarchiveItem,
  starItem,
  unstarItem,
  markRead,
  markUnread,
} from "@/app/(app)/item/[id]/actions";

interface ItemFlags {
  archived: boolean;
  starred: boolean;
  read: boolean;
}

/**
 * Single global keyboard layer + command palette + shortcut help dialog.
 * Replaces the older per-page FeedShortcuts and KeyboardShortcuts.
 */
export function GlobalShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [, startTransition] = useTransition();

  const selectedId = params.get("selected");

  const getRows = useCallback(
    () => Array.from(document.querySelectorAll<HTMLElement>("[data-feed-card]")),
    [],
  );

  const onFeed = pathname === "/feed";

  const buildHref = useCallback(
    (next: Record<string, string | null | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === undefined) sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      return qs ? `/feed?${qs}` : "/feed";
    },
    [params],
  );

  const focusRowByIndex = useCallback(
    (i: number) => {
      const rows = getRows();
      if (rows.length === 0) return;
      const next = Math.max(0, Math.min(rows.length - 1, i));
      rows[next].focus();
      rows[next].scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [getRows],
  );

  const currentRowIndex = useCallback((): number => {
    const rows = getRows();
    if (selectedId) {
      const idx = rows.findIndex((r) => r.dataset.feedCard === selectedId);
      if (idx >= 0) return idx;
    }
    const active = document.activeElement as HTMLElement | null;
    if (active?.dataset?.feedCard) {
      const idx = rows.findIndex((r) => r === active);
      if (idx >= 0) return idx;
    }
    return -1;
  }, [getRows, selectedId]);

  const navigateRowDelta = useCallback(
    (delta: number) => {
      const rows = getRows();
      if (rows.length === 0) return;
      const cur = currentRowIndex();
      const next = cur < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, cur + delta));
      // If pane is open (selectedId set), keep it open with the new row.
      if (selectedId) {
        const id = rows[next].dataset.feedCard;
        if (id) router.push(buildHref({ selected: id }));
      } else {
        focusRowByIndex(next);
      }
    },
    [getRows, currentRowIndex, selectedId, router, buildHref, focusRowByIndex],
  );

  const openCurrentRow = useCallback(() => {
    const rows = getRows();
    const cur = currentRowIndex();
    const idx = cur < 0 ? 0 : cur;
    const row = rows[idx];
    if (!row) return;
    const id = row.dataset.feedCard;
    if (!id) return;
    router.push(buildHref({ selected: id }));
  }, [getRows, currentRowIndex, router, buildHref]);

  const closePane = useCallback(() => {
    if (selectedId) router.push(buildHref({ selected: null }));
  }, [selectedId, router, buildHref]);

  // Resolve "the active item" for s/e/m: selected pane > focused row > first row.
  const activeItemId = useCallback((): string | null => {
    if (selectedId) return selectedId;
    const rows = getRows();
    const active = document.activeElement as HTMLElement | null;
    if (active?.dataset?.feedCard) return active.dataset.feedCard;
    return rows[0]?.dataset.feedCard ?? null;
  }, [selectedId, getRows]);

  // Best-effort read of current flags from the DOM (selected row).
  const activeFlags = useCallback((): ItemFlags => {
    const id = activeItemId();
    const row = id ? document.querySelector<HTMLElement>(`[data-feed-card="${id}"]`) : null;
    return {
      archived: row?.dataset.archived === "1",
      starred: row?.dataset.starred === "1",
      read: row?.dataset.read === "1",
    };
  }, [activeItemId]);

  const runWithUndo = useCallback(
    (
      doFn: () => Promise<unknown>,
      undoFn: () => Promise<unknown>,
      msg: { done: string; undo?: string },
    ) => {
      startTransition(async () => {
        await doFn();
        registerUndo(() => {
          void undoFn().then(() => router.refresh());
        });
        toast({ title: msg.done, description: msg.undo ?? "Press u to undo" });
        router.refresh();
      });
    },
    [router],
  );

  useEffect(() => {
    let leader: "g" | null = null;
    let leaderTimer: ReturnType<typeof setTimeout> | null = null;

    function isTyping(e: KeyboardEvent): boolean {
      const t = e.target as HTMLElement | null;
      if (!t) return false;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return true;
      return !!t.isContentEditable;
    }

    function onKeyDown(e: KeyboardEvent) {
      // ⌘K / Ctrl+K always works
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e)) return;

      // Leader-key chord (g + …)
      if (leader === "g") {
        const k = e.key;
        leader = null;
        if (leaderTimer) clearTimeout(leaderTimer);
        e.preventDefault();
        if (k === "i") router.push("/feed");
        else if (k === "s") router.push("/feed?view=saved");
        else if (k === "a") router.push("/feed?view=archived");
        else if (k === "p") router.push("/feed?context=personal");
        else if (k === "f") router.push("/feed?context=family");
        else if (k === "w") router.push("/feed?context=wealth");
        else if (k === "h") router.push("/feed?context=health");
        else if (k === "t") router.push("/feed?context=twistag");
        else if (k === "c") router.push("/chat");
        return;
      }

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (e.key === "g") {
        leader = "g";
        if (leaderTimer) clearTimeout(leaderTimer);
        leaderTimer = setTimeout(() => (leader = null), 1200);
        return;
      }

      if (e.key === "Escape") {
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (selectedId) {
          e.preventDefault();
          closePane();
          return;
        }
      }

      if (!onFeed) return;

      if (e.key === "j") {
        e.preventDefault();
        navigateRowDelta(+1);
        return;
      }
      if (e.key === "k") {
        e.preventDefault();
        navigateRowDelta(-1);
        return;
      }
      if (e.key === "o" || e.key === "Enter") {
        e.preventDefault();
        openCurrentRow();
        return;
      }
      if (e.key === "e") {
        e.preventDefault();
        const id = activeItemId();
        if (!id) return;
        const flags = activeFlags();
        if (flags.archived) {
          runWithUndo(
            () => unarchiveItem(id),
            () => archiveItem(id),
            { done: "Unarchived" },
          );
        } else {
          runWithUndo(
            () => archiveItem(id),
            () => unarchiveItem(id),
            { done: "Archived" },
          );
        }
        return;
      }
      if (e.key === "s") {
        e.preventDefault();
        const id = activeItemId();
        if (!id) return;
        const flags = activeFlags();
        if (flags.starred) {
          runWithUndo(
            () => unstarItem(id),
            () => starItem(id),
            { done: "Unstarred" },
          );
        } else {
          runWithUndo(
            () => starItem(id),
            () => unstarItem(id),
            { done: "Saved" },
          );
        }
        return;
      }
      if (e.key === "m") {
        e.preventDefault();
        const id = activeItemId();
        if (!id) return;
        const flags = activeFlags();
        if (flags.read) {
          runWithUndo(
            () => markUnread(id),
            () => markRead(id),
            { done: "Marked unread" },
          );
        } else {
          runWithUndo(
            () => markRead(id),
            () => markUnread(id),
            { done: "Marked read" },
          );
        }
        return;
      }
      if (e.key === "u") {
        e.preventDefault();
        if (runUndoIfPending()) {
          toast({ title: "Undone" });
        }
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (leaderTimer) clearTimeout(leaderTimer);
    };
  }, [
    router,
    paletteOpen,
    selectedId,
    closePane,
    onFeed,
    navigateRowDelta,
    openCurrentRow,
    activeItemId,
    activeFlags,
    runWithUndo,
  ]);

  return (
    <>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onShowShortcuts={() => setHelpOpen(true)}
      />
      <ShortcutHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
