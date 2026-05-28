"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Shortcut {
  keys: string[];
  description: string;
  scope?: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["?"], description: "Show this shortcuts help" },
  { keys: ["/"], description: "Go to search" },
  { keys: ["n"], description: "Go to feed (new save)" },
  { keys: ["g", "then", "f"], description: "Go to feed" },
  { keys: ["g", "then", "c"], description: "Go to chat" },
  { keys: ["g", "then", "s"], description: "Go to search" },
  { keys: ["j"], description: "Next card", scope: "Feed" },
  { keys: ["k"], description: "Previous card", scope: "Feed" },
  { keys: ["o", "or", "Enter"], description: "Open focused card", scope: "Feed" },
  { keys: ["e"], description: "Archive focused card", scope: "Feed" },
];

/**
 * Global keyboard shortcuts (PRD §13.3, §3.7).
 * Skips when the user is typing in an input/textarea/contenteditable.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e)) return;

      if (leader === "g") {
        if (e.key === "f") router.push("/feed");
        else if (e.key === "c") router.push("/chat");
        else if (e.key === "s") router.push("/search");
        leader = null;
        if (leaderTimer) clearTimeout(leaderTimer);
        return;
      }

      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen((v) => !v);
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
        return;
      }
      if (e.key === "n") {
        e.preventDefault();
        router.push("/feed");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (leaderTimer) clearTimeout(leaderTimer);
    };
  }, [router]);

  return <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />;
}

function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Press ? to toggle this help.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y text-sm">
          {SHORTCUTS.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-4 py-2">
              <span>
                {s.description}
                {s.scope && (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {s.scope}
                  </span>
                )}
              </span>
              <span className="flex gap-1">
                {s.keys.map((k, j) =>
                  k === "then" || k === "or" ? (
                    <span key={j} className="text-xs text-muted-foreground">
                      {k}
                    </span>
                  ) : (
                    <kbd
                      key={j}
                      className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs"
                    >
                      {k}
                    </kbd>
                  ),
                )}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
