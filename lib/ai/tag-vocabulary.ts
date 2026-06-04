import { createServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/log";

/**
 * Return the user's most-used tag names, ordered by usage frequency desc.
 *
 * The summarizer reads this as preferred vocabulary so it reuses existing
 * tags ("ai", "machine-learning") instead of inventing near-duplicates
 * ("a-i", "ml") on every save. We send only the names — count is irrelevant
 * to the model and would only inflate tokens.
 */
export async function getPreferredTags(userId: string, limit = 30): Promise<string[]> {
  try {
    const supabase = createServiceClient();
    // Tag usage = number of item_tags rows referencing this tag for this user.
    const { data, error } = await supabase
      .from("tags")
      .select("name, item_tags!inner(item_id)")
      .eq("user_id", userId);
    if (error || !data) {
      log.warn("preferred_tags.query_failed", { error: error?.message });
      return [];
    }
    const counts = new Map<string, number>();
    for (const row of data as unknown as Array<{
      name: string;
      item_tags: Array<{ item_id: string }>;
    }>) {
      counts.set(row.name, (counts.get(row.name) ?? 0) + row.item_tags.length);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name]) => name);
  } catch (err) {
    log.warn("preferred_tags.threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
