import Link from "next/link";
import Image from "next/image";
import { FileText, Image as ImageIcon, Link2, Play, FileType } from "lucide-react";
import type { ContentType, ItemStatus } from "@/lib/db/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/utils";

interface FeedItem {
  id: string;
  title: string | null;
  canonical_url: string;
  type: ContentType;
  hero_image_url: string | null;
  status: ItemStatus;
  read_time_minutes: number | null;
  is_paywalled: boolean;
  source_domain: string | null;
  created_at: string;
}

export function FeedList({ items }: { items: FeedItem[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <FeedCard item={item} />
        </li>
      ))}
    </ul>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  const isPending = item.status === "pending" || item.status === "extracting";
  return (
    <Link
      href={`/item/${item.id}`}
      className="group block overflow-hidden rounded-lg border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {item.hero_image_url ? (
          <Image
            src={item.hero_image_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : isPending ? (
          <Skeleton className="absolute inset-0" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <TypeIcon type={item.type} className="h-10 w-10" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          <TypeBadge type={item.type} />
          {item.is_paywalled && <Badge variant="warning">paywalled</Badge>}
        </div>
      </div>
      <div className="p-4">
        {isPending && !item.title ? (
          <Skeleton className="h-5 w-3/4" />
        ) : (
          <h3 className="line-clamp-2 text-base font-medium leading-snug">
            {item.title ?? new URL(item.canonical_url).hostname}
          </h3>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {item.source_domain ?? new URL(item.canonical_url).hostname}
          </span>
          <span aria-hidden>·</span>
          <span>{formatRelativeTime(item.created_at)}</span>
          {item.read_time_minutes ? (
            <>
              <span aria-hidden>·</span>
              <span>{item.read_time_minutes} min</span>
            </>
          ) : null}
        </div>
        {item.status === "failed" && (
          <Badge variant="destructive" className="mt-2">
            extraction failed
          </Badge>
        )}
      </div>
    </Link>
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
      return <Link2 className={className} />;
  }
}

function TypeBadge({ type }: { type: ContentType }) {
  const labels: Record<ContentType, string> = {
    article: "Article",
    youtube: "YouTube",
    pdf: "PDF",
    image: "Image",
    generic: "Link",
  };
  return <Badge variant="secondary">{labels[type]}</Badge>;
}
