import { requireUser, createClient } from "@/lib/supabase/server";
import { FeedHeader } from "@/components/feed/feed-header";
import { FeedList } from "@/components/feed/feed-list";
import { EmptyState } from "@/components/feed/empty-state";

export const dynamic = "force-dynamic";

interface FeedPageProps {
  searchParams: Promise<{ filter?: string; tag?: string; q?: string }>;
}

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("items")
    .select(
      "id, title, canonical_url, type, hero_image_url, status, read_time_minutes, is_paywalled, source_domain, created_at, archived_at",
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (params.filter === "archived") {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  const { data: items, error } = await query;

  return (
    <div className="container max-w-6xl py-8">
      <FeedHeader />
      {error ? (
        <div className="mt-8 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          Could not load feed: {error.message}
        </div>
      ) : !items || items.length === 0 ? (
        <EmptyState />
      ) : (
        <FeedList items={items} />
      )}
    </div>
  );
}
