import { requireUser } from "@/lib/supabase/server";
import { ListPane } from "@/components/feed/list-pane";
import { ReaderEmpty } from "@/components/feed/reader-empty";
import { FeedShortcuts } from "@/components/feed/feed-shortcuts";
import { loadFeed, viewTitle, type FeedView } from "@/lib/shell/feed-query";

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

  const { items, total } = await loadFeed(user.id, filters);
  const title = viewTitle(filters);
  const filtered = !!(params.view || params.context || params.tag);

  return (
    <div className="flex h-full w-full">
      <FeedShortcuts />
      <div className="flex w-full min-w-0 lg:w-[420px] lg:flex-shrink-0 xl:w-[460px]">
        <ListPane
          items={items}
          title={title}
          count={total}
          selectedId={params.selected ?? null}
          emptyFiltered={filtered}
          emptyFilterLabel={title}
        />
      </div>
      <div className="hidden min-w-0 flex-1 lg:block">
        <ReaderEmpty />
      </div>
    </div>
  );
}
