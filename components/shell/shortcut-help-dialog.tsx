"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Shortcut {
  keys: string[];
  description: string;
  scope?: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["⌘", "K"], description: "Command palette" },
  { keys: ["/"], description: "Focus search" },
  { keys: ["?"], description: "Show this help" },
  { keys: ["j"], description: "Next item", scope: "List" },
  { keys: ["k"], description: "Previous item", scope: "List" },
  { keys: ["o", "Enter"], description: "Open in pane", scope: "List" },
  { keys: ["Esc"], description: "Close pane / dialog" },
  { keys: ["e"], description: "Archive · Unarchive", scope: "Item" },
  { keys: ["s"], description: "Star · Unstar", scope: "Item" },
  { keys: ["m"], description: "Mark read · unread", scope: "Item" },
  { keys: ["u"], description: "Undo last action" },
  { keys: ["g", "i"], description: "Go to Inbox" },
  { keys: ["g", "s"], description: "Go to Saved" },
  { keys: ["g", "a"], description: "Go to Archived" },
  {
    keys: ["g", "p / f / w / h / t"],
    description: "Go to Personal · Family · Wealth · Health · Twistag",
  },
  { keys: ["g", "c"], description: "Go to Chat" },
];

export function ShortcutHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <ul className="divide-y text-sm">
          {SHORTCUTS.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-4 py-2">
              <span className="flex items-center gap-2">
                <span>{s.description}</span>
                {s.scope && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {s.scope}
                  </span>
                )}
              </span>
              <span className="flex flex-shrink-0 items-center gap-1">
                {s.keys.map((k, j) => (
                  <kbd
                    key={j}
                    className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
