"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SidebarRow } from "./sidebar-row";
import { cn } from "@/lib/utils";
import type { SidebarTag } from "@/lib/shell/sidebar-data";

export function SidebarTags({ tags }: { tags: SidebarTag[] }) {
  const [open, setOpen] = useState(false);
  if (tags.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between px-2 pb-1 pt-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
          Tags
        </span>
        <CollapsibleTrigger
          className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          aria-label={open ? "Collapse tags" : "Expand tags"}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-0.5">
        {tags.map((t) => (
          <SidebarRow
            key={t.id}
            href={`/feed?tag=${encodeURIComponent(t.name)}`}
            label={`#${t.name}`}
            match={{ pathname: "/feed", search: { tag: t.name } }}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
