import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { embedQuery } from "@/lib/ai/embeddings";

export interface SearchHit {
  itemId: string;
  title: string;
  snippet: string;
  score: number;
  kind: "fts" | "semantic";
}

export async function searchLibrary(
  userId: string,
  query: string,
  limit = 20,
): Promise<SearchHit[]> {
  const fts = await ftsSearch(query, limit);
  const sem = await semanticSearch(userId, query, limit);
  const merged = mergeUnique([...sem, ...fts], limit);
  return merged;
}

async function ftsSearch(query: string, limit: number): Promise<SearchHit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("item_content")
    .select("item_id, raw_text, items!inner(id, title)")
    .textSearch("tsv", query, { type: "websearch" })
    .limit(limit);
  if (!data) return [];
  return (
    data as unknown as Array<{
      item_id: string;
      raw_text: string | null;
      items: { title: string | null };
    }>
  ).map((r) => ({
    itemId: r.item_id,
    title: r.items.title ?? "Untitled",
    snippet: snippetFromText(r.raw_text, query),
    score: 0.5,
    kind: "fts",
  }));
}

async function semanticSearch(userId: string, query: string, limit: number): Promise<SearchHit[]> {
  const vec = await embedQuery(query);
  if (!vec) return [];
  const supabase = createServiceClient();
  const { data } = await supabase.rpc("match_embeddings", {
    query_embedding: vec as unknown as number[],
    match_count: limit,
    user_id_filter: userId,
  });
  if (!data) return [];
  const ids = Array.from(new Set(data.map((r) => r.item_id)));
  const { data: items } = await supabase.from("items").select("id, title").in("id", ids);
  const titles = new Map((items ?? []).map((i) => [i.id, i.title ?? "Untitled"]));
  return data.map((r) => ({
    itemId: r.item_id,
    title: titles.get(r.item_id) ?? "Untitled",
    snippet: r.chunk_text.slice(0, 240),
    score: r.similarity,
    kind: "semantic" as const,
  }));
}

function snippetFromText(text: string | null, query: string): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  const q = query
    .toLowerCase()
    .split(/\s+/)
    .find((t) => t.length > 2);
  if (!q) return text.slice(0, 240);
  const idx = lower.indexOf(q);
  if (idx === -1) return text.slice(0, 240);
  const start = Math.max(0, idx - 80);
  return (start > 0 ? "…" : "") + text.slice(start, start + 240) + "…";
}

function mergeUnique(hits: SearchHit[], limit: number): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of hits.sort((a, b) => b.score - a.score)) {
    if (seen.has(h.itemId)) continue;
    seen.add(h.itemId);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}
