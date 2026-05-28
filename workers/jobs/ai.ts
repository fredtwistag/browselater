import { generateObject } from "ai";
import { createServiceClient } from "@/lib/supabase/service";
import { logEvent } from "@/lib/events";
import { log } from "@/lib/log";
import { captureError } from "@/lib/errors";
import { chunkText } from "@/lib/ai/chunk";
import { embedBatch } from "@/lib/ai/embeddings";
import { haiku, sonnet } from "@/lib/ai/claude";
import { summarySchema, SUMMARY_SYSTEM, summaryUserPrompt } from "@/lib/ai/prompts/summary";
import {
  insightsResponseSchema,
  INSIGHTS_SYSTEM,
  insightsUserPrompt,
} from "@/lib/ai/prompts/insights";
import { getLatestProfile } from "@/lib/ai/profile";

export interface AiInput {
  itemId: string;
  userId: string;
}

export async function runAiPipeline({ itemId, userId }: AiInput): Promise<void> {
  const supabase = createServiceClient();

  const { data: item } = await supabase
    .from("items")
    .select("id, canonical_url, title, type")
    .eq("id", itemId)
    .single();
  const { data: content } = await supabase
    .from("item_content")
    .select("raw_text")
    .eq("item_id", itemId)
    .single();

  if (!item || !content?.raw_text) {
    log.warn("ai.no_content", { itemId });
    return;
  }

  // 1) Embeddings
  await runEmbeddings({ itemId, userId, rawText: content.raw_text });

  // 2) Summary (Haiku)
  await logEvent("ai.summary.started", userId, { itemId });
  const summary = await generateSummary({
    title: item.title,
    url: item.canonical_url,
    type: item.type,
    text: content.raw_text,
  }).catch(async (err) => {
    await captureError("ai.summary", err, { itemId }, userId);
    return null;
  });

  if (!summary) {
    await logEvent("ai.summary.failed" as never, userId, { itemId });
    return;
  }

  const nextVersion = await nextAiVersion(itemId);

  await supabase.from("item_ai").insert({
    item_id: itemId,
    version: nextVersion,
    at_a_glance_md: summary.at_a_glance_md,
    summary_md: summary.summary_md,
    takeaways_md: summary.takeaways_md,
    primary_context: summary.primary_context,
    model: process.env.ANTHROPIC_MODEL_HAIKU ?? "claude-haiku-4-5-20251001",
  });

  // Persist tags
  await saveTags(itemId, userId, summary.tags);
  await logEvent("ai.summary.completed", userId, { itemId, version: nextVersion });

  // 3) Insights (Sonnet)
  await logEvent("ai.insights.started", userId, { itemId });
  const profileMd = await getLatestProfile(userId);

  const insights = await generateInsights({
    summary: summary.summary_md,
    takeaways: summary.takeaways_md,
    profileMd,
  }).catch(async (err) => {
    await captureError("ai.insights", err, { itemId }, userId);
    return null;
  });

  if (insights && insights.cards.length > 0) {
    const rows = insights.cards.map((c) => ({
      item_id: itemId,
      version: nextVersion,
      context: c.context,
      headline: c.headline,
      body_md: c.body_md,
      suggested_actions_md: c.suggested_actions_md ?? null,
      confidence: c.confidence,
    }));
    await supabase.from("insight_cards").insert(rows);
  }
  await logEvent("ai.insights.completed", userId, {
    itemId,
    version: nextVersion,
    cardCount: insights?.cards.length ?? 0,
  });
}

async function runEmbeddings({
  itemId,
  userId,
  rawText,
}: {
  itemId: string;
  userId: string;
  rawText: string;
}): Promise<void> {
  const chunks = chunkText(rawText);
  if (chunks.length === 0) return;

  // Voyage allows batches up to 128. We send in groups of 32 for safety.
  const supabase = createServiceClient();
  for (let i = 0; i < chunks.length; i += 32) {
    const batch = chunks.slice(i, i + 32);
    const vectors = await embedBatch(batch.map((c) => c.text));
    if (!vectors) {
      log.warn("embed.batch_skipped", { itemId, start: i });
      return;
    }
    const rows = batch.map((c, j) => ({
      item_id: itemId,
      user_id: userId,
      chunk_index: c.index,
      chunk_text: c.text,
      tokens: c.tokens,
      embedding: vectors[j].vector as unknown as string, // pgvector accepts number[] serialized
    }));
    // supabase-js sends as JSON; pgvector input accepts the array literal "[..]" or a JSON array.
    await supabase.from("embeddings").upsert(rows as never);
  }
}

async function generateSummary(args: {
  title: string | null;
  url: string;
  type: string;
  text: string;
}) {
  const { object } = await generateObject({
    model: haiku(),
    schema: summarySchema,
    system: SUMMARY_SYSTEM,
    prompt: summaryUserPrompt(args),
    maxRetries: 2,
  });
  return object;
}

async function generateInsights(args: { summary: string; takeaways: string; profileMd: string }) {
  const { object } = await generateObject({
    model: sonnet(),
    schema: insightsResponseSchema,
    system: INSIGHTS_SYSTEM,
    prompt: insightsUserPrompt(args),
    maxRetries: 1,
  });
  return object;
}

async function nextAiVersion(itemId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("item_ai")
    .select("version")
    .eq("item_id", itemId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version ?? 0) + 1;
}

async function saveTags(itemId: string, userId: string, tags: string[]): Promise<void> {
  if (!tags.length) return;
  const supabase = createServiceClient();
  for (const name of tags) {
    const clean = name.trim().toLowerCase().slice(0, 60);
    if (!clean) continue;
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .eq("name", clean)
      .maybeSingle();
    let tagId = existing?.id;
    if (!tagId) {
      const { data: created } = await supabase
        .from("tags")
        .insert({ user_id: userId, name: clean })
        .select("id")
        .single();
      tagId = created?.id;
    }
    if (tagId) {
      await supabase.from("item_tags").upsert({ item_id: itemId, tag_id: tagId, source: "ai" });
    }
  }
}
