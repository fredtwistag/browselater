"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, FileType, Image as ImageIcon, Lock, Play, Star } from "lucide-react";
import type { ContentType, ItemStatus, Context } from "@/lib/db/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatRelativeTime } from "@/lib/utils";
import { contextLabel, contextTintVar } from "@/lib/shell/contexts";
import { itemViewTransitionName } from "@/lib/view-transitions";

export interface ListItem {
  id: string;
  title: string | null;
  canonical_url: string;
  type: ContentType;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  status: ItemStatus;
  read_time_minutes: number | null;
  is_paywalled: boolean;
  source_domain: string | null;
  created_at: string;
  read_at: string | null;
  starred_at: string | null;
  archived_at: string | null;
  primary_context: Context | null;
}

interface ListRowProps {
  item: ListItem;
  selected?: boolean;
}

export function ListRow({ item, selected = false }: ListRowProps) {
  const router = useRouter();
  const params = useSearchParams();
  const isPending = item.status === "pending" || item.status === "extracting";
  const unread = !item.read_at;
  const tint = contextTintVar(item.primary_context);
  const ctxLabel = contextLabel(item.primary_context);
  const imageVt = itemViewTransitionName(item.id, "image");
  const titleVt = itemViewTransitionName(item.id, "title");

  // Preserve current filters (view/context/tag/q) and set selected.
  const next = new URLSearchParams(params.toString());
  next.set("selected", item.id);
  const href = `/feed?${next.toString()}`;

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (typeof document.startViewTransition !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    e.preventDefault();
    document.startViewTransition(() => router.push(href));
  }

  return (
    <a
      href={href}
      onClick={onClick}
      data-feed-card={item.id}
      data-vt-image={imageVt}
      data-vt-title={titleVt}
      data-starred={item.starred_at ? "1" : "0"}
      data-read={item.read_at ? "1" : "0"}
      data-archived={item.archived_at ? "1" : "0"}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative flex gap-3 rounded-md border border-transparent px-3 py-2.5 outline-none transition-colors",
        "hover:bg-secondary/50",
        "focus-visible:border-ring focus-visible:bg-secondary/50",
        selected && "bg-secondary",
      )}
      style={
        selected && tint ? ({ background: `hsl(${tint} / 0.4)` } as React.CSSProperties) : undefined
      }
    >
      {/* Unread dot rail */}
      <span
        className={cn(
          "mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full transition-opacity",
          unread ? "bg-primary opacity-100" : "opacity-0",
        )}
        aria-hidden
      />

      {/* Thumb */}
      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded bg-muted">
        {item.hero_image_url ? (
          <Image
            src={item.hero_image_url}
            alt={item.hero_image_alt ?? item.title ?? ""}
            fill
            sizes="64px"
            className="object-cover"
            style={{ viewTransitionName: imageVt }}
          />
        ) : isPending ? (
          <Skeleton className="absolute inset-0" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <TypeIcon type={item.type} className="h-5 w-5" />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {isPending && !item.title ? (
          <Skeleton className="h-4 w-3/4" />
        ) : (
          <h3
            className={cn(
              "line-clamp-2 text-[13.5px] leading-snug transition-[font-weight] duration-300",
              unread ? "font-semibold text-foreground" : "font-normal text-foreground/85",
            )}
            style={{ viewTransitionName: titleVt }}
          >
            {item.title ?? new URL(item.canonical_url).hostname}
          </h3>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="truncate">{item.source_domain ?? hostnameSafe(item.canonical_url)}</span>
          {item.read_time_minutes ? (
            <>
              <Sep />
              <span className="tabular-nums">{item.read_time_minutes} min</span>
            </>
          ) : null}
          <Sep />
          <span className="whitespace-nowrap">{formatRelativeTime(item.created_at)}</span>
          {item.is_paywalled && (
            <>
              <Sep />
              <span className="inline-flex items-center gap-0.5">
                <Lock className="h-2.5 w-2.5" /> paywalled
              </span>
            </>
          )}
        </div>
        {ctxLabel && tint && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: `hsl(${tint})` }}
              aria-hidden
            />
            <span className="text-muted-foreground/90">{ctxLabel}</span>
          </div>
        )}
      </div>

      {/* Star indicator */}
      {item.starred_at && (
        <Star
          className="mt-1 h-3.5 w-3.5 flex-shrink-0 fill-amber-400 text-amber-500"
          aria-label="Saved"
        />
      )}
    </a>
  );
}

function Sep() {
  return (
    <span aria-hidden className="text-muted-foreground/40">
      ·
    </span>
  );
}

function TypeIcon({ type, className }: { type: ContentType; className?: string }) {
  switch (type) {
    case "article":
      return <FileText className={className} />;
    case "youtube":
      return <Play className={className} />;
    case "pdf":
      return <FileType className={className} />;
    case "image":
      return <ImageIcon className={className} />;
    default:
      return <FileText className={className} />;
  }
}

function hostnameSafe(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
