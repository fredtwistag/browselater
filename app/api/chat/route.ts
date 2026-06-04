import { streamText, generateText, StreamData, type CoreMessage } from "ai";
import { requireUser, createClient } from "@/lib/supabase/server";
import { haiku, sonnet } from "@/lib/ai/claude";
import { embedQuery } from "@/lib/ai/embeddings";
import { createServiceClient } from "@/lib/supabase/service";
import { logEvent } from "@/lib/events";
import { log } from "@/lib/log";
import { getLatestProfile } from "@/lib/ai/profile";
import { logUsage, readAnthropicCacheStats } from "@/lib/ai/usage";
import {
  CHAT_SYSTEM,
  chatProfileBlock,
  chatTurnContent,
  QUERY_REWRITE_SYSTEM,
  queryRewriteUserPrompt,
  looksLikeFollowUp,
} from "@/lib/ai/prompts/chat";

export const runtime = "nodejs";
export const maxDuration = 60;

const HAIKU_MODEL = process.env.ANTHROPIC_MODEL_HAIKU ?? "claude-haiku-4-5-20251001";
const SONNET_MODEL = process.env.ANTHROPIC_MODEL_SONNET ?? "claude-sonnet-4-6";

const CACHE_EPHEMERAL = {
  anthropic: { cacheControl: { type: "ephemeral" as const } },
};

// Keep the most recent N exchanges of conversation history. Older context
// rarely earns its tokens; aggressive truncation keeps latency + cost flat as
// sessions grow.
const HISTORY_KEEP = 6;

interface ChatRequest {
  messages: CoreMessage[];
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json()) as ChatRequest;

  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  const question = messageText(lastUser);

  await logEvent("chat.query", user.id, { len: question.length });

  // Conversation context (everything except the current user turn) drives both
  // query-rewriting and the messages we replay to the model.
  const priorMessages = body.messages.slice(0, -1);
  const recentHistory = priorMessages.slice(-HISTORY_KEEP);

  // Query-rewrite pre-pass for short follow-ups. The model still sees the
  // original question text — only retrieval uses the rewrite.
  let retrievalQuery = question;
  if (recentHistory.length > 0 && looksLikeFollowUp(question)) {
    const rewritten = await rewriteFollowUpQuery(recentHistory, question, user.id);
    if (rewritten) {
      log.info("chat.query_rewritten", { original: question, rewritten });
      retrievalQuery = rewritten;
    }
  }

  const retrieved = await retrieve(user.id, retrievalQuery);

  const data = new StreamData();
  data.append({
    sources: retrieved.map((r, i) => ({
      index: i + 1,
      id: r.item_id,
      title: r.title,
      url: r.url,
    })),
  });

  const profileMd = await getLatestProfile(user.id);
  const currentUserContent = chatTurnContent({
    snippets: retrieved.map((r, i) => ({
      index: i + 1,
      title: r.title,
      chunkText: r.chunk_text,
    })),
    question,
  });

  // Two system messages flatten into a cached system block under the hood:
  // the static rules + the personalization profile. Recent conversation
  // follows, then the augmented current turn.
  const messages: CoreMessage[] = [
    { role: "system", content: CHAT_SYSTEM, providerOptions: CACHE_EPHEMERAL },
    {
      role: "system",
      content: chatProfileBlock(profileMd),
      providerOptions: CACHE_EPHEMERAL,
    },
    ...recentHistory,
    { role: "user", content: currentUserContent },
  ];

  const result = streamText({
    model: sonnet(),
    messages,
    onFinish: async ({ usage, providerMetadata }) => {
      const cache = readAnthropicCacheStats(providerMetadata as Record<string, unknown>);
      await logUsage({
        call: "chat",
        model: SONNET_MODEL,
        userId: user.id,
        inputTokens: usage?.promptTokens ?? 0,
        outputTokens: usage?.completionTokens ?? 0,
        cacheCreationTokens: cache.cacheCreationTokens,
        cacheReadTokens: cache.cacheReadTokens,
      });
      data.close();
    },
  });

  return result.toDataStreamResponse({ data });
}

async function rewriteFollowUpQuery(
  history: CoreMessage[],
  current: string,
  userId: string,
): Promise<string | null> {
  const flattened = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      text: messageText(m),
    }))
    .filter((m) => m.text.length > 0)
    .slice(-2);

  if (flattened.length === 0) return null;

  try {
    const result = await generateText({
      model: haiku(),
      system: QUERY_REWRITE_SYSTEM,
      prompt: queryRewriteUserPrompt({ history: flattened, current }),
      maxRetries: 1,
    });
    const cleaned = result.text.trim().replace(/^["']|["']$/g, "");
    if (!cleaned) return null;
    const cache = readAnthropicCacheStats(result.providerMetadata as Record<string, unknown>);
    await logUsage({
      call: "query_rewrite",
      model: HAIKU_MODEL,
      userId,
      inputTokens: result.usage?.promptTokens ?? 0,
      outputTokens: result.usage?.completionTokens ?? 0,
      cacheCreationTokens: cache.cacheCreationTokens,
      cacheReadTokens: cache.cacheReadTokens,
    });
    return cleaned;
  } catch (err) {
    log.warn("chat.query_rewrite_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function messageText(msg: CoreMessage | undefined): string {
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.map((p) => ("text" in p ? p.text : "")).join(" ");
  }
  return "";
}

interface Retrieved {
  item_id: string;
  chunk_text: string;
  title: string;
  url: string;
}

async function retrieve(userId: string, question: string): Promise<Retrieved[]> {
  const supabase = createServiceClient();

  const queryVec = await embedQuery(question);
  if (queryVec) {
    const { data } = await supabase.rpc("match_embeddings", {
      query_embedding: queryVec as unknown as number[],
      match_count: 6,
      user_id_filter: userId,
    });
    if (data && data.length > 0) {
      return enrichItems(data.map((r) => ({ item_id: r.item_id, chunk_text: r.chunk_text })));
    }
  }

  // Fallback: FTS on raw_text
  const userClient = await createClient();
  const { data } = await userClient
    .from("item_content")
    .select("item_id, raw_text, items!inner(id, title, canonical_url, user_id)")
    .textSearch("tsv", question, { type: "websearch" })
    .limit(6);
  if (!data) return [];
  return (
    data as unknown as Array<{
      item_id: string;
      raw_text: string | null;
      items: { title: string | null; canonical_url: string };
    }>
  ).map((r) => ({
    item_id: r.item_id,
    chunk_text: r.raw_text?.slice(0, 1200) ?? "",
    title: r.items.title ?? "Untitled",
    url: r.items.canonical_url,
  }));
}

async function enrichItems(rows: { item_id: string; chunk_text: string }[]): Promise<Retrieved[]> {
  if (rows.length === 0) return [];
  const supabase = createServiceClient();
  const ids = Array.from(new Set(rows.map((r) => r.item_id)));
  const { data } = await supabase.from("items").select("id, title, canonical_url").in("id", ids);
  const meta = new Map(
    (data ?? []).map((d) => [d.id, { title: d.title ?? "Untitled", url: d.canonical_url }]),
  );
  return rows.map((r) => ({
    item_id: r.item_id,
    chunk_text: r.chunk_text,
    title: meta.get(r.item_id)?.title ?? "Untitled",
    url: meta.get(r.item_id)?.url ?? "",
  }));
}
