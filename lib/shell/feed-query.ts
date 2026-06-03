import { createClient } from "@/lib/supabase/server";
import type { Context, ContentType, ItemStatus } from "@/lib/db/types";

export type FeedView = "inbox" | "saved" | "archived";

export type FeedRow = {
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
  primary_context: Context | null;
};

export interface FeedFilters {
  view: FeedView;
  context?: string;
  tag?: string;
}

export interface FeedResult {
  items: FeedRow[];
  total: number;
}

const LIST_LIMIT = 100;

export async function loadFeed(userId: string, filters: FeedFilters): Promise<FeedResult> {
  const supabase = await createClient();

  // Resolve item-id pre-filters (context, tag) into a Set so we can intersect.
  let idFilter: string[] | null = null;

  if (filters.context) {
    let query = supabase.from("item_ai").select("item_id, primary_context");
    if (filters.context === "twistag") {
      query = query.like("primary_context", "twistag.%");
    } else {
      query = query.eq("primary_context", filters.context as Context);
    }
    const { data } = await query;
    const ids = [...new Set((data ?? []).map((r) => r.item_id))];
    idFilter = ids;
    if (idFilter.length === 0) return { items: [], total: 0 };
  }

  if (filters.tag) {
    const { data: tagRow } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .eq("name", filters.tag)
      .maybeSingle();
    if (!tagRow) return { items: [], total: 0 };
    const { data: tagItems } = await supabase
      .from("item_tags")
      .select("item_id")
      .eq("tag_id", tagRow.id);
    const ids = (tagItems ?? []).map((r) => r.item_id);
    if (ids.length === 0) return { items: [], total: 0 };
    idFilter = idFilter ? idFilter.filter((id) => ids.includes(id)) : ids;
    if (idFilter.length === 0) return { items: [], total: 0 };
  }

  let q = supabase
    .from("items")
    .select(
      `id, title, canonical_url, type, hero_image_url, hero_image_alt,
       status, read_time_minutes, is_paywalled, source_domain,
       created_at, archived_at, read_at, starred_at,
       item_ai(primary_context, version)`,
      { count: "exact" },
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (filters.view === "archived") {
    q = q.not("archived_at", "is", null);
  } else if (filters.view === "saved") {
    q = q.not("starred_at", "is", null).is("archived_at", null);
  } else {
    q = q.is("archived_at", null);
  }

  if (idFilter) q = q.in("id", idFilter);

  const { data, count, error } = await q;
  if (error) throw error;

  type Row = {
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
    item_ai: { primary_context: Context | null; version: number }[] | null;
  };

  const items: FeedRow[] = ((data ?? []) as unknown as Row[]).map((row) => {
    const ai = row.item_ai ?? [];
    const latest = ai.length > 0 ? ai.reduce((a, b) => (a.version > b.version ? a : b)) : null;
    return {
      id: row.id,
      title: row.title,
      canonical_url: row.canonical_url,
      type: row.type,
      hero_image_url: row.hero_image_url,
      hero_image_alt: row.hero_image_alt,
      status: row.status,
      read_time_minutes: row.read_time_minutes,
      is_paywalled: row.is_paywalled,
      source_domain: row.source_domain,
      created_at: row.created_at,
      read_at: row.read_at,
      starred_at: row.starred_at,
      primary_context: latest?.primary_context ?? null,
    };
  });

  return { items, total: count ?? items.length };
}

export function viewTitle(filters: FeedFilters): string {
  if (filters.tag) return `#${filters.tag}`;
  if (filters.context) {
    const map: Record<string, string> = {
      personal: "Personal",
      family: "Family",
      wealth: "Wealth",
      health: "Health",
      twistag: "Twistag",
    };
    return map[filters.context] ?? filters.context;
  }
  if (filters.view === "saved") return "Saved";
  if (filters.view === "archived") return "Archived";
  return "Inbox";
}
