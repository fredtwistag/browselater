import { createClient } from "@/lib/supabase/server";
import type {
  Context,
  Confidence,
  ContentType,
  ItemStatus,
  SourceQuality,
  Feedback,
} from "@/lib/db/types";

export type ReaderItem = {
  id: string;
  title: string | null;
  author: string | null;
  published_at: string | null;
  hero_image_url: string | null;
  hero_image_alt: string | null;
  canonical_url: string;
  original_url: string;
  type: ContentType;
  status: ItemStatus;
  error_message: string | null;
  is_paywalled: boolean;
  source_domain: string | null;
  read_time_minutes: number | null;
  created_at: string;
  archived_at: string | null;
  user_notes: string;
  read_at: string | null;
  starred_at: string | null;
};

export type ReaderAi = {
  id: string;
  version: number;
  at_a_glance_md: string | null;
  summary_md: string | null;
  takeaways_md: string | null;
  primary_context: Context | null;
  source_quality: SourceQuality | null;
  created_at: string;
} | null;

export type ReaderInsight = {
  id: string;
  context: Context;
  headline: string;
  body_md: string;
  suggested_actions_md: string | null;
  confidence: Confidence;
  user_feedback: Feedback;
  version: number;
};

export type ReaderContent = {
  raw_text: string | null;
  transcript_json: unknown | null;
  pdf_storage_key: string | null;
  image_storage_key: string | null;
  html_snapshot_key: string | null;
} | null;

export type ItemBundle = {
  item: ReaderItem;
  latestAi: ReaderAi;
  insights: ReaderInsight[];
  tags: string[];
  content: ReaderContent;
};

export async function loadItemBundle(itemId: string, userId: string): Promise<ItemBundle | null> {
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("items")
    .select(
      `id, title, author, published_at, hero_image_url, hero_image_alt,
       canonical_url, original_url, type, status, error_message, is_paywalled,
       source_domain, read_time_minutes, created_at, archived_at, user_notes,
       read_at, starred_at`,
    )
    .eq("id", itemId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!item) return null;

  const { data: aiVersions } = await supabase
    .from("item_ai")
    .select(
      "id, version, at_a_glance_md, summary_md, takeaways_md, primary_context, source_quality, created_at",
    )
    .eq("item_id", itemId)
    .order("version", { ascending: false })
    .limit(1);
  const latestAi = (aiVersions?.[0] ?? null) as ReaderAi;

  const { data: insights } = await supabase
    .from("insight_cards")
    .select(
      "id, context, headline, body_md, suggested_actions_md, confidence, user_feedback, version",
    )
    .eq("item_id", itemId)
    .eq("version", latestAi?.version ?? 0)
    .order("confidence", { ascending: false });

  const { data: tagsRaw } = await supabase
    .from("item_tags")
    .select("source, tag:tags(name)")
    .eq("item_id", itemId);

  const tagNames = (tagsRaw ?? [])
    .map((t) => (Array.isArray(t.tag) ? t.tag[0]?.name : (t.tag as { name?: string } | null)?.name))
    .filter((n): n is string => !!n);

  const { data: content } = await supabase
    .from("item_content")
    .select("raw_text, transcript_json, pdf_storage_key, image_storage_key, html_snapshot_key")
    .eq("item_id", itemId)
    .maybeSingle();

  return {
    item: item as ReaderItem,
    latestAi,
    insights: (insights ?? []) as ReaderInsight[],
    tags: tagNames,
    content: (content ?? null) as ReaderContent,
  };
}
