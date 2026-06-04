import { z } from "zod";

export const CONTEXT_KEYS = [
  "personal",
  "family",
  "wealth",
  "health",
  "twistag.ops",
  "twistag.sales",
  "twistag.devex",
  "twistag.innovation",
  "twistag.marketing",
] as const;

export const insightCardSchema = z.object({
  context: z.enum(CONTEXT_KEYS),
  headline: z
    .string()
    .min(8)
    .max(140)
    .describe("One sentence summarizing the insight. No emojis. No quotes."),
  body_md: z
    .string()
    .describe(
      "2–4 sentences in markdown explaining why this applies to the owner, linking the source to their stated situation. Be specific. Reference details from the personalization profile.",
    ),
  suggested_actions_md: z
    .string()
    .nullable()
    .describe(
      "1–3 markdown bullet actions the owner could take. Each starts with a verb. Null if no concrete action is warranted.",
    ),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe(
      "Your honest confidence that this insight is useful given the source AND the owner's context. Use 'low' generously — better to mark it than to overclaim.",
    ),
});

export const insightsResponseSchema = z.object({
  cards: z.array(insightCardSchema).max(9),
});

export type InsightCard = z.infer<typeof insightCardSchema>;
export type InsightsResponse = z.infer<typeof insightsResponseSchema>;

export const INSIGHTS_SYSTEM = `You are BrowseLater's personalized insights writer.

You are given:
1. A summary of saved content.
2. The owner's personalization profile across five contexts: Personal, Family, Wealth, Health, and Twistag (with sub-areas Ops, Sales, DevEx, Innovation, Marketing).

Your job is to surface insight cards — one per context that *genuinely applies* to the source.

Hard rules:
- BE SELECTIVE. Most sources do not deserve all nine cards. Many deserve zero or one. Empty contexts must be skipped, never padded with weak filler. A response with zero cards is acceptable and often correct.
- Anchor "why it applies" in *specific* facts from the owner's profile — names, ages, routines, decisions in flight. Generic encouragement is not an insight.
- Suggested actions must be concrete. "Schedule a 20-minute weekly review" beats "be more strategic". Null is fine if no action is warranted.
- Calibrate confidence honestly. If you are stretching to connect the source to a context, the confidence is "low" and probably you shouldn't include the card at all.
- Never reveal or quote the personalization profile back to the user — refer to it indirectly ("given your morning routine", not "as your profile says...").
- Output strictly matches the schema.

# Example — when zero cards is the right answer

<example>
Source summary: A technical post-mortem of a Redis cluster outage at a fintech company in Singapore. Discusses split-brain detection, sentinel quorum tuning, and a specific bug in their failover script.

Owner profile (sketch): independent consultant in Portugal, focused on family and small-team operations, not running Redis or fintech infra.

Correct output:
{ "cards": [] }

WHY: There is no genuine connection between the source and any of the owner's five contexts. Forcing a "twistag.devex" card here ("interesting failure mode to be aware of") would be exactly the weak filler the rules forbid. Zero cards is the honest answer.
</example>`;

/**
 * The cacheable prefix of the insights user message: just the personalization
 * profile. Stable across calls for a given profile version, so we anchor
 * Anthropic prompt-caching here. Cache invalidates naturally when the user
 * edits their profile (new content → new cache).
 */
export function insightsProfileBlock(profileMd: string): string {
  return `# Personalization profile (private)\n\n${profileMd}`;
}

/**
 * The per-call suffix: the source summary + takeaways + the optional
 * primary-context hint. Varies on every call, so it sits AFTER the cache
 * boundary.
 */
export function insightsVariableBlock(args: {
  summary: string;
  takeaways: string;
  primaryContext?: string | null;
}): string {
  const hint = args.primaryContext
    ? `The summarizer identified "${args.primaryContext}" as the dominant context. Use this as a strong prior but do not be bound by it — generate cards for any context that genuinely applies and skip the rest.\n\n---\n\n`
    : "";
  return `---\n\n# Source summary\n\n${args.summary}\n\n---\n\n# Key takeaways\n\n${args.takeaways}\n\n---\n\n${hint}Now generate the insight cards. Skip contexts that don't genuinely apply. Zero cards is acceptable.`;
}

/**
 * Legacy single-string user prompt — preserved so any non-caching caller still
 * works. The worker uses the split blocks above so the profile can be cached.
 */
export function insightsUserPrompt(args: {
  summary: string;
  takeaways: string;
  profileMd: string;
  primaryContext?: string | null;
}): string {
  return `${insightsProfileBlock(args.profileMd)}\n\n${insightsVariableBlock(args)}`;
}
