import { createServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/log";

export type AiCallName = "summary" | "insights" | "chat" | "query_rewrite";

export interface AiUsage {
  call: AiCallName;
  model: string;
  userId: string;
  itemId?: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export async function logUsage(usage: AiUsage): Promise<void> {
  const row = {
    user_id: usage.userId,
    call: usage.call,
    model: usage.model,
    input_tokens: Math.max(0, Math.round(usage.inputTokens || 0)),
    output_tokens: Math.max(0, Math.round(usage.outputTokens || 0)),
    cache_creation_tokens: Math.max(0, Math.round(usage.cacheCreationTokens || 0)),
    cache_read_tokens: Math.max(0, Math.round(usage.cacheReadTokens || 0)),
    item_id: usage.itemId ?? null,
  };
  log.info("ai.usage", row);
  try {
    const supabase = createServiceClient();
    await supabase.from("ai_call_log").insert(row);
  } catch (err) {
    log.warn("ai.usage.persist_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Pull cache stats out of the Vercel AI SDK's providerMetadata for an Anthropic
 * call. Returns zeros when the provider didn't report them (e.g. cache miss
 * before any caching was attempted, or non-Anthropic providers).
 */
export function readAnthropicCacheStats(providerMetadata: Record<string, unknown> | undefined): {
  cacheCreationTokens: number;
  cacheReadTokens: number;
} {
  const anthropic = (providerMetadata?.anthropic ?? {}) as {
    cacheCreationInputTokens?: number | null;
    cacheReadInputTokens?: number | null;
  };
  return {
    cacheCreationTokens: anthropic.cacheCreationInputTokens ?? 0,
    cacheReadTokens: anthropic.cacheReadInputTokens ?? 0,
  };
}
