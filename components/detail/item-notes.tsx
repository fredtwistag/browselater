"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { saveItemNotes } from "@/app/(app)/item/[id]/actions";

export function ItemNotes({ itemId, initialNotes }: { itemId: string; initialNotes: string }) {
  const [value, setValue] = useState(initialNotes);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value === initialNotes) return;
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await saveItemNotes({ itemId, notes: value });
      setSaved("saved");
    }, 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, itemId, initialNotes]);

  return (
    <section aria-labelledby="notes-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="notes-heading" className="font-serif text-2xl font-semibold tracking-tight">
          My notes
        </h2>
        <span className="text-xs text-muted-foreground">
          {saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : ""}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Notes go here. Markdown is fine."
        className="min-h-[160px]"
      />
    </section>
  );
}
