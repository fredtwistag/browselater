"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, ExternalLink, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { archiveItem, unarchiveItem, deleteItem, rerunAi } from "@/app/(app)/item/[id]/actions";

interface ItemActionsProps {
  itemId: string;
  isArchived: boolean;
  canonicalUrl: string;
}

export function ItemActions({ itemId, isArchived, canonicalUrl }: ItemActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-2 p-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => startTransition(() => rerunAi(itemId))}
          disabled={pending}
        >
          <RefreshCw className="h-4 w-4" />
          Re-run AI
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            navigator.clipboard.writeText(canonicalUrl).then(() => toast({ title: "URL copied" }))
          }
        >
          <Copy className="h-4 w-4" />
          Copy URL
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={canonicalUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Open source
          </a>
        </Button>
        {isArchived ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(() => unarchiveItem(itemId).then(() => router.refresh()))
            }
          >
            <ArchiveRestore className="h-4 w-4" />
            Unarchive
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => startTransition(() => archiveItem(itemId).then(() => router.refresh()))}
          >
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="col-span-2 text-destructive hover:text-destructive"
          disabled={pending}
          onClick={() => {
            if (!confirm("Delete this item? It will go to trash for 30 days.")) return;
            startTransition(() => deleteItem(itemId).then(() => router.push("/feed")));
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </CardContent>
    </Card>
  );
}
