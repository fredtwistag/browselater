import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { ContextBadge } from "./context-badge";
import { itemViewTransitionName } from "@/lib/view-transitions";
import type { ContentType, Context, ItemStatus } from "@/lib/db/types";

interface ItemHeaderProps {
  item: {
    id: string;
    title: string | null;
    author: string | null;
    published_at: string | null;
    hero_image_url: string | null;
    hero_image_alt: string | null;
    canonical_url: string;
    source_domain: string | null;
    type: ContentType;
    status: ItemStatus;
    is_paywalled: boolean;
    read_time_minutes: number | null;
    created_at: string;
  };
  tags: string[];
  primaryContext: Context | null;
}

export function ItemHeader({ item, tags, primaryContext }: ItemHeaderProps) {
  return (
    <header className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{item.source_domain ?? new URL(item.canonical_url).hostname}</span>
        {item.author && (
          <>
            <span aria-hidden>·</span>
            <span>{item.author}</span>
          </>
        )}
        {item.published_at && (
          <>
            <span aria-hidden>·</span>
            <time dateTime={item.published_at}>
              {new Date(item.published_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          </>
        )}
        <span aria-hidden>·</span>
        <span>saved {formatRelativeTime(item.created_at)}</span>
        {item.read_time_minutes ? (
          <>
            <span aria-hidden>·</span>
            <span>{item.read_time_minutes} min read</span>
          </>
        ) : null}
      </div>

      <h1
        className="text-balance font-serif text-3xl font-semibold leading-tight tracking-tight md:text-4xl"
        style={{ viewTransitionName: itemViewTransitionName(item.id, "title") }}
      >
        {item.title ?? new URL(item.canonical_url).hostname}
      </h1>

      <div className="flex flex-wrap items-center gap-2">
        {primaryContext && <ContextBadge context={primaryContext} />}
        {item.is_paywalled && <Badge variant="warning">paywalled</Badge>}
        {tags.slice(0, 6).map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
        <a
          href={item.canonical_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          Open source <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {item.hero_image_url && item.type !== "youtube" && (
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border bg-muted">
          <Image
            src={item.hero_image_url}
            alt={item.hero_image_alt ?? item.title ?? ""}
            fill
            sizes="(max-width: 1024px) 100vw, 720px"
            className="object-cover"
            priority
            style={{ viewTransitionName: itemViewTransitionName(item.id, "image") }}
          />
        </div>
      )}
    </header>
  );
}
