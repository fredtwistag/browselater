import Link from "next/link";
import { Bookmark, MousePointer2 } from "lucide-react";

interface EmptyStateProps {
  filtered?: boolean;
  filterLabel?: string;
}

export function EmptyState({ filtered = false, filterLabel }: EmptyStateProps) {
  if (filtered) {
    return (
      <div className="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/30 p-10 text-center">
        <h2 className="text-base font-medium">Nothing matches “{filterLabel}”</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Try a different filter, or clear it to see everything.
        </p>
        <Link href="/feed" className="mt-4 text-sm text-primary underline-offset-4 hover:underline">
          Clear filter
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-16 flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/30 p-12 text-center">
      <div className="rounded-full bg-secondary p-4">
        <Bookmark className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-medium">No saves yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Paste a URL above to get started. Articles, YouTube videos, PDFs, and images all work.
      </p>
      <Link
        href="/settings/profile"
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
      >
        <MousePointer2 className="h-4 w-4" />
        Or grab the bookmarklet from settings
      </Link>
    </div>
  );
}
