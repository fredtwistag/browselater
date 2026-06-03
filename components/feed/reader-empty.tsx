import { Sparkles } from "lucide-react";

export function ReaderEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-10 text-center text-muted-foreground">
      <div className="rounded-full border bg-secondary/40 p-4">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="mt-4 text-sm font-medium text-foreground">Select an item</h2>
      <p className="mt-1 max-w-xs text-xs">
        Pick something from the list to read its summary, takeaways, and personalized insights.
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
        <ShortcutHint k="j / k" label="navigate" />
        <ShortcutHint k="o" label="open" />
        <ShortcutHint k="e" label="archive" />
        <ShortcutHint k="?" label="all shortcuts" />
      </ul>
    </div>
  );
}

function ShortcutHint({ k, label }: { k: string; label: string }) {
  return (
    <li className="flex items-center justify-end gap-2">
      <kbd className="rounded border bg-card px-1.5 py-0.5 font-mono text-[10px]">{k}</kbd>
      <span>{label}</span>
    </li>
  );
}
