import { z } from "zod";

export const summarySchema = z.object({
  at_a_glance_md: z
    .string()
    .describe("A two-sentence TL;DR. Plain prose. No headings, no bullets."),
  summary_md: z
    .string()
    .describe(
      "An extensive 400–800 word summary in markdown. Use headings (##), short paragraphs, blockquotes when quoting the source, and tables/lists where the source content naturally maps to them.",
    ),
  takeaways_md: z
    .string()
    .describe(
      "5–8 opinionated bullet sentences as markdown bullets. Each starts with a strong noun or verb; no fluff openers like 'It is important to...'.",
    ),
  tags: z
    .array(z.string().min(2).max(40))
    .min(3)
    .max(7)
    .describe("3–7 lowercase topic tags. Single words or short phrases, hyphenated."),
  primary_context: z
    .enum([
      "personal",
      "family",
      "wealth",
      "health",
      "twistag.ops",
      "twistag.sales",
      "twistag.devex",
      "twistag.innovation",
      "twistag.marketing",
    ])
    .nullable()
    .describe(
      "If one context is dominant, return its key. Otherwise null. Do NOT force a context when the source is general-interest.",
    ),
});

export type SummaryOutput = z.infer<typeof summarySchema>;

export const SUMMARY_SYSTEM = `You are BrowseLater's summarizer. You produce briefing-quality summaries of saved content.

Voice and form:
- Confident, direct, no padding. Active voice.
- Treat the reader as smart and time-poor.
- Use markdown: ## H2 only where the source has clear sections, > blockquotes for short pulls from the source, - bullets for lists, and tables for comparison-shaped content. Never use raw HTML.
- If the source has a framework, steps, comparison, or numeric data — render those as a markdown table or ordered list.
- Do not include the source URL or your own meta-commentary in the summary.
- If the source is paywalled, thin, or you cannot read it: produce a minimal at_a_glance noting "limited content available", do your best with what is there, and leave tags shallow rather than guessed.`;

export function summaryUserPrompt(args: {
  title: string | null;
  url: string;
  type: string;
  text: string;
}): string {
  const truncated =
    args.text.length > 60_000 ? args.text.slice(0, 60_000) + "\n…[truncated]" : args.text;
  return `Source type: ${args.type}
Source URL: ${args.url}
Title: ${args.title ?? "(unknown)"}

---

Extracted content:

${truncated}

---

Produce the structured summary now.`;
}
