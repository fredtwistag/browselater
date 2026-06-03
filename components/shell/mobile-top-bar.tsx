"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "./app-sidebar";
import type { SidebarCounts, SidebarTag } from "@/lib/shell/sidebar-data";

interface MobileTopBarProps {
  user: { email: string; avatarUrl: string | null };
  counts: SidebarCounts;
  tags: SidebarTag[];
}

export function MobileTopBar({ user, counts, tags }: MobileTopBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className="-ml-1 rounded p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Open sidebar"
        >
          <Menu className="h-4 w-4" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <div className="h-full" onClick={() => setOpen(false)}>
            <AppSidebar user={user} counts={counts} tags={tags} />
          </div>
        </SheetContent>
      </Sheet>
      <Link href="/feed" className="text-sm font-semibold tracking-tight">
        BrowseLater
      </Link>
    </header>
  );
}
