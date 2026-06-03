"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface SidebarRowProps {
  href: string;
  label: string;
  count?: number | null;
  icon?: React.ReactNode;
  dot?: string | null;
  /** When set, row is active when these search params match the URL */
  match?: { pathname?: string; search?: Record<string, string | undefined> };
}

export function SidebarRow({ href, label, count, icon, dot, match }: SidebarRowProps) {
  const pathname = usePathname();
  const params = useSearchParams();

  const wantsPath = match?.pathname ?? new URL(href, "http://x").pathname;
  const onPath = pathname === wantsPath;

  let searchMatch = true;
  if (match?.search) {
    for (const [k, v] of Object.entries(match.search)) {
      const got = params.get(k);
      if (v === undefined) {
        if (got !== null) searchMatch = false;
      } else if (got !== v) {
        searchMatch = false;
      }
    }
  } else {
    // If no search match provided, only match when there are no relevant filters
    if (wantsPath === "/feed") {
      const hasFilters =
        params.has("view") || params.has("context") || params.has("tag") || params.has("selected");
      if (hasFilters) searchMatch = false;
    }
  }

  const active = onPath && searchMatch;

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      {dot ? (
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: `hsl(${dot})` }}
          aria-hidden
        />
      ) : icon ? (
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-current">
          {icon}
        </span>
      ) : null}
      <span className="flex-1 truncate">{label}</span>
      {typeof count === "number" && count > 0 && (
        <span
          className={cn(
            "ml-1 inline-flex min-w-[1.25rem] justify-center rounded px-1 text-[11px] tabular-nums",
            active ? "bg-background text-foreground" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
