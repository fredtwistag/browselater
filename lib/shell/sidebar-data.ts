import { createClient } from "@/lib/supabase/server";

export type SidebarCounts = {
  inboxUnread: number;
  saved: number;
  archived: number;
};

export type SidebarTag = { id: string; name: string };

export async function loadSidebarData(userId: string): Promise<{
  counts: SidebarCounts;
  tags: SidebarTag[];
}> {
  const supabase = await createClient();

  const [unread, saved, archived, tags] = await Promise.all([
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .is("read_at", null),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("starred_at", "is", null),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("archived_at", "is", null),
    supabase.from("tags").select("id, name").eq("user_id", userId).order("name").limit(40),
  ]);

  return {
    counts: {
      inboxUnread: unread.count ?? 0,
      saved: saved.count ?? 0,
      archived: archived.count ?? 0,
    },
    tags: tags.data ?? [],
  };
}
