"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rerunAi } from "@/app/(app)/item/[id]/actions";

export function FailedNote({ itemId, reason }: { itemId: string; reason: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
      <p>Extraction failed: {classify(reason)}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => startTransition(() => rerunAi(itemId))}
        disabled={pending}
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        Retry extraction
      </Button>
    </div>
  );
}

function classify(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("paywall")) return "the source is paywalled.";
  if (lower.includes("http 4")) return "the source returned a 4xx error.";
  if (lower.includes("http 5")) return "the source returned a 5xx error.";
  if (lower.includes("timeout") || lower.includes("aborted"))
    return "the source took too long to respond.";
  return reason;
}
