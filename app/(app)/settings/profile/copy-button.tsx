"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export function CopyButton({ text }: { text: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => navigator.clipboard.writeText(text).then(() => toast({ title: "Copied" }))}
    >
      <Copy className="h-4 w-4" />
      Copy
    </Button>
  );
}
