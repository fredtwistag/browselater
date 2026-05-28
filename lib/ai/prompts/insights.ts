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
- Output strictly matches the schema.`;

export function insightsUserPrompt(args: {
  summary: string;
  takeaways: string;
  profileMd: string;
}): string {
  return `# Personalization profile (private)

${args.profileMd}

---

# Source summary

${args.summary}

---

# Key takeaways

${args.takeaways}

---

Now generate the insight cards. Skip contexts that don't genuinely apply. Zero cards is acceptable.`;
}
