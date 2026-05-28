"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";

export function SaveInput() {
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
        if (data.duplicate) {
          toast({
            title: "Already saved",
            description: "Surfacing the existing item.",
          });
        } else {
          toast({ title: "Saved", description: "Extracting content..." });
        }
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
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="url"
        placeholder="https://..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={pending}
        className="flex-1"
        autoComplete="off"
        inputMode="url"
      />
      <Button type="submit" disabled={pending || !url.trim()}>
        <Plus className="h-4 w-4" />
        Save
      </Button>
    </form>
  );
}
