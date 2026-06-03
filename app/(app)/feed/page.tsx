import { requireUser } from "@/lib/supabase/server";
import { ListPane } from "@/components/feed/list-pane";
import { ReaderEmpty } from "@/components/feed/reader-empty";
import { ReaderPane } from "@/components/detail/reader-pane";
import { FeedShortcuts } from "@/components/feed/feed-shortcuts";
import { loadFeed, viewTitle, type FeedView } from "@/lib/shell/feed-query";
import { loadItemBundle } from "@/lib/detail/load-item";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface FeedPageProps {
  searchParams: Promise<{
    view?: string;
    context?: string;
    tag?: string;
    selected?: string;
  }>;
}

const VALID_VIEWS: FeedView[] = ["inbox", "saved", "archived"];

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const user = await requireUser();
  const params = await searchParams;

  const view = (VALID_VIEWS.includes(params.view as FeedView) ? params.view : "inbox") as FeedView;
  const filters = { view, context: params.context, tag: params.tag };

  const [{ items, total }, bundle] = await Promise.all([
    loadFeed(user.id, filters),
    params.selected ? loadItemBundle(params.selected, user.id) : Promise.resolve(null),
  ]);

  const title = viewTitle(filters);
  const filtered = !!(params.view || params.context || params.tag);
  const selectedId = bundle?.item.id ?? null;

  // Build a "back to list" href that preserves filters (drops selected).
  const backParams = new URLSearchParams();
  if (params.view) backParams.set("view", params.view);
  if (params.context) backParams.set("context", params.context);
  if (params.tag) backParams.set("tag", params.tag);
  const backHref = `/feed${backParams.toString() ? `?${backParams.toString()}` : ""}`;

  return (
    <div className="flex h-full w-full">
      <FeedShortcuts />
      <div
        className={cn(
          "flex min-w-0 lg:w-[420px] lg:flex-shrink-0 xl:w-[460px]",
          selectedId ? "hidden lg:flex" : "w-full",
        )}
      >
        <ListPane
          items={items}
          title={title}
          count={total}
          selectedId={selectedId}
          emptyFiltered={filtered}
          emptyFilterLabel={title}
        />
      </div>
      <div className={cn("min-w-0 flex-1", selectedId ? "flex" : "hidden lg:flex")}>
        {bundle ? (
          <ReaderPane bundle={bundle} backHref={backHref} backMobileOnly />
        ) : (
          <ReaderEmpty />
        )}
      </div>
    </div>
  );
}
