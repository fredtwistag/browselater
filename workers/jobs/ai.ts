import { generateObject, type CoreMessage } from "ai";
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
  insightsProfileBlock,
  insightsVariableBlock,
} from "@/lib/ai/prompts/insights";
import { getLatestProfile } from "@/lib/ai/profile";
import { getPreferredTags } from "@/lib/ai/tag-vocabulary";
import { logUsage, readAnthropicCacheStats } from "@/lib/ai/usage";

const HAIKU_MODEL = process.env.ANTHROPIC_MODEL_HAIKU ?? "claude-haiku-4-5-20251001";
const SONNET_MODEL = process.env.ANTHROPIC_MODEL_SONNET ?? "claude-sonnet-4-6";

const CACHE_EPHEMERAL = {
  anthropic: { cacheControl: { type: "ephemeral" as const } },
};

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
  const preferredTags = await getPreferredTags(userId, 30);
  const summary = await generateSummary({
    title: item.title,
    url: item.canonical_url,
    type: item.type,
    text: content.raw_text,
    preferredTags,
    userId,
    itemId,
  }).catch(async (err) => {
    await captureError("ai.summary", err, { itemId }, userId);
    return null;
  });

  if (!summary) {
    await logEvent("ai.summary.failed", userId, { itemId });
    return;
  }

  const nextVersion = await nextAiVersion(itemId);

  const { error: aiErr } = await supabase.from("item_ai").insert({
    item_id: itemId,
    version: nextVersion,
    at_a_glance_md: summary.at_a_glance_md,
    summary_md: summary.summary_md,
    takeaways_md: summary.takeaways_md,
    primary_context: summary.primary_context,
    source_quality: summary.source_quality,
    model: HAIKU_MODEL,
  });
  if (aiErr) {
    // Summary row didn't persist — bail before insights, which would otherwise
    // produce cards pointing at a version that doesn't exist.
    await captureError("ai.save_summary", aiErr, { itemId, version: nextVersion }, userId);
    return;
  }

  // Persist tags
  await saveTags(itemId, userId, summary.tags);
  await logEvent("ai.summary.completed", userId, { itemId, version: nextVersion });

  // 3) Insights (Sonnet) — skip entirely on title-only sources; the model has
  // nothing concrete to reason from and any "insight" would be fabricated.
  if (summary.source_quality === "title_only") {
    await logEvent("ai.insights.completed", userId, {
      itemId,
      version: nextVersion,
      cardCount: 0,
      skipped: "title_only",
    });
    return;
  }

  await logEvent("ai.insights.started", userId, { itemId });
  const profileMd = await getLatestProfile(userId);

  const insights = await generateInsights({
    summary: summary.summary_md,
    takeaways: summary.takeaways_md,
    profileMd,
    primaryContext: summary.primary_context ?? null,
    userId,
    itemId,
  }).catch(async (err) => {
    await captureError("ai.insights", err, { itemId }, userId);
    return null;
  });

  let savedCardCount = insights?.cards.length ?? 0;
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
    const { error: cardsErr } = await supabase.from("insight_cards").insert(rows);
    if (cardsErr) {
      await captureError(
        "ai.save_insights",
        cardsErr,
        { itemId, version: nextVersion, cardCount: rows.length },
        userId,
      );
      savedCardCount = 0;
    }
  }
  await logEvent("ai.insights.completed", userId, {
    itemId,
    version: nextVersion,
    cardCount: savedCardCount,
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
    const { error: embErr } = await supabase.from("embeddings").upsert(rows as never);
    if (embErr) {
      // Later batches will likely fail the same way; bail out of embeddings
      // (not the whole pipeline — summary/insights still run).
      await captureError("ai.save_embeddings", embErr, { itemId, batchStart: i }, userId);
      return;
    }
  }
}

async function generateSummary(args: {
  title: string | null;
  url: string;
  type: string;
  text: string;
  preferredTags?: string[];
  userId: string;
  itemId: string;
}) {
  // System prompt is stable across saves → cache it. User prompt varies per
  // item, so it sits AFTER the cache boundary.
  const messages: CoreMessage[] = [
    { role: "system", content: SUMMARY_SYSTEM, providerOptions: CACHE_EPHEMERAL },
    {
      role: "user",
      content: summaryUserPrompt({
        title: args.title,
        url: args.url,
        type: args.type,
        text: args.text,
        preferredTags: args.preferredTags,
      }),
    },
  ];

  const result = await generateObject({
    model: haiku(),
    schema: summarySchema,
    messages,
    maxRetries: 2,
  });

  const cache = readAnthropicCacheStats(result.providerMetadata);
  await logUsage({
    call: "summary",
    model: HAIKU_MODEL,
    userId: args.userId,
    itemId: args.itemId,
    inputTokens: result.usage?.promptTokens ?? 0,
    outputTokens: result.usage?.completionTokens ?? 0,
    cacheCreationTokens: cache.cacheCreationTokens,
    cacheReadTokens: cache.cacheReadTokens,
  });

  return result.object;
}

export async function generateInsights(args: {
  summary: string;
  takeaways: string;
  profileMd: string;
  primaryContext?: string | null;
  userId: string;
  itemId: string;
}) {
  // Two cache anchors: (1) the system prompt, (2) the personalization profile
  // at the start of the user message. Both are stable per profile version, so
  // a typical save replays them as cache_read on every insights call.
  const messages: CoreMessage[] = [
    { role: "system", content: INSIGHTS_SYSTEM, providerOptions: CACHE_EPHEMERAL },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: insightsProfileBlock(args.profileMd),
          providerOptions: CACHE_EPHEMERAL,
        },
        {
          type: "text",
          text: insightsVariableBlock({
            summary: args.summary,
            takeaways: args.takeaways,
            primaryContext: args.primaryContext ?? null,
          }),
        },
      ],
    },
  ];

  const result = await generateObject({
    model: sonnet(),
    schema: insightsResponseSchema,
    messages,
    maxRetries: 1,
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 2000 },
      },
    },
  });

  const cache = readAnthropicCacheStats(result.providerMetadata);
  await logUsage({
    call: "insights",
    model: SONNET_MODEL,
    userId: args.userId,
    itemId: args.itemId,
    inputTokens: result.usage?.promptTokens ?? 0,
    outputTokens: result.usage?.completionTokens ?? 0,
    cacheCreationTokens: cache.cacheCreationTokens,
    cacheReadTokens: cache.cacheReadTokens,
  });

  return result.object;
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

export async function saveTags(itemId: string, userId: string, tags: string[]): Promise<void> {
  const clean = [...new Set(tags.map((n) => n.trim().toLowerCase().slice(0, 60)).filter(Boolean))];
  if (!clean.length) return;
  const supabase = createServiceClient();

  // One upsert that absorbs the `unique (user_id, name)` constraint instead of
  // racing it with a SELECT-then-INSERT per tag.
  const { data: tagRows, error: tagErr } = await supabase
    .from("tags")
    .upsert(
      clean.map((name) => ({ user_id: userId, name })),
      { onConflict: "user_id,name", ignoreDuplicates: false },
    )
    .select("id, name");
  if (tagErr || !tagRows) {
    await captureError("ai.save_tags", tagErr ?? new Error("no rows"), { itemId }, userId);
    return;
  }

  const { error: itemTagErr } = await supabase
    .from("item_tags")
    .upsert(tagRows.map((t) => ({ item_id: itemId, tag_id: t.id, source: "ai" as const })));
  if (itemTagErr) {
    await captureError("ai.save_item_tags", itemTagErr, { itemId }, userId);
  }
}
