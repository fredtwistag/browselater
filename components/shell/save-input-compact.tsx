"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

export function SaveInputCompact() {
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { id: string; duplicate?: boolean };
        toast({
          title: data.duplicate ? "Already saved" : "Saved",
          description: data.duplicate ? "Surfacing the existing item." : "Extracting…",
        });
        setUrl("");
        router.refresh();
      } catch (err) {
        toast({
          title: "Save failed",
          description: err instanceof Error ? err.message : "Try again.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "group flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 transition-colors",
        "focus-within:border-ring/60 focus-within:ring-1 focus-within:ring-ring/20",
      )}
    >
      <Plus className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <input
        type="url"
        placeholder="Paste a URL…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={pending}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
        autoComplete="off"
        inputMode="url"
        aria-label="Save a URL"
      />
      {pending && (
        <span
          className="h-3 w-3 animate-spin rounded-full border border-muted-foreground/40 border-t-foreground"
          aria-hidden
        />
      )}
    </form>
  );
}
