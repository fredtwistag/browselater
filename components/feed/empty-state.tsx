import { Bookmark } from "lucide-react";

export function EmptyState() {
  return (
    <div className="mt-16 flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/30 p-12 text-center">
      <div className="rounded-full bg-secondary p-4">
        <Bookmark className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-medium">No saves yet</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Paste a URL above to get started. Articles, YouTube videos, PDFs, and images all work.
      </p>
    </div>
  );
}
