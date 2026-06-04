import { z } from "zod";

export const summarySchema = z.object({
  at_a_glance_md: z
    .string()
    .describe("A two-sentence TL;DR. Plain prose. No headings, no bullets."),
  summary_md: z
    .string()
    .describe(
      "An extensive 400–800 word summary in markdown when source content is rich. " +
        "When source content is thin or title-only, return a SHORT honest summary (1–3 paragraphs) " +
        "that reflects only what's actually in the source — never extrapolate, never invent details, " +
        "never describe what the linked-but-unfetched article 'probably' says.",
    ),
  takeaways_md: z
    .string()
    .describe(
      "5–8 opinionated bullet sentences as markdown bullets, drawn ONLY from explicit statements in the source. " +
        "Each starts with a strong noun or verb; no fluff openers like 'It is important to...'. " +
        "When the source is too thin to support 5 takeaways, return fewer (or an empty string). " +
        "Never invent supporting bullets to hit the count.",
    ),
  tags: z
    .array(z.string().min(2).max(40))
    .min(1)
    .max(7)
    .describe(
      "1–7 lowercase topic tags. Single words or short phrases, hyphenated. " +
        "Only tag what's actually evidenced in the source.",
    ),
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
  source_quality: z
    .enum(["full", "thin", "title_only"])
    .describe(
      "Honest assessment of how much real content you had to work with. " +
        "`full` = real article/transcript/PDF body. " +
        "`thin` = a snippet, a tweet, a description — some content but not the full piece. " +
        "`title_only` = effectively nothing but a headline and a link you cannot follow.",
    ),
});

export type SummaryOutput = z.infer<typeof summarySchema>;

export const SUMMARY_SYSTEM = `You are BrowseLater's summarizer. You produce briefing-quality summaries of saved content.

# ABSOLUTE RULE — DO NOT FABRICATE
You may ONLY summarize what is actually present in the extracted content provided. You MUST NOT:
- Invent specific details, claims, framework names, statistics, or quotes that aren't in the source
- Describe what a linked-but-unfetched article "probably" or "would" cover
- Pad a thin source up to the 400–800 word target by inferring from your prior knowledge
- Treat a tweet's announcement of an article as a summary of that article

If the source is a tweet, a headline, or a stub that announces or links to longer content WITHOUT including that content, your summary describes ONLY the tweet/headline itself ("X tweeted that Y was published, linking to it"), and you set source_quality="title_only".

If the source has 1-3 paragraphs of real content but not a full piece, set source_quality="thin" and keep the summary proportional to what's actually there — typically 100–250 words, not a forced 400+.

Only set source_quality="full" when you have the real article body, transcript, or PDF text.

# Voice and form
- Confident, direct, no padding. Active voice.
- Treat the reader as smart and time-poor.
- Use markdown: ## H2 only where the source has clear sections, > blockquotes for short pulls from the source, - bullets for lists, and tables for comparison-shaped content. Never use raw HTML.
- If the source has a framework, steps, comparison, or numeric data — render those as a markdown table or ordered list.
- Do not include the source URL or your own meta-commentary in the summary body.
- If the source is paywalled, set source_quality="title_only" and produce a one-line at_a_glance noting it's paywalled.

# Examples

<example>
Source type: article
Title: New paper claims transformers can do X
Extracted content (45 chars): "@karpathy: new paper drops, this is huge: arxiv.org/abs/2401.xxxxx"

Correct output:
{
  "at_a_glance_md": "Karpathy tweeted a link to an arXiv paper claiming transformers can do X. The tweet itself contains no description of the paper's argument.",
  "summary_md": "Karpathy posted a one-line endorsement (\"this is huge\") of a newly-released arXiv paper at arxiv.org/abs/2401.xxxxx. The tweet does not summarize, quote, or describe the paper's contents — only links to it.",
  "takeaways_md": "",
  "tags": ["twitter", "arxiv"],
  "primary_context": null,
  "source_quality": "title_only"
}
WHY: The source is a stub. Describing what the paper "probably argues" would be fabrication.
</example>

<example>
Source type: article
Title: How we shipped feature flags at scale
Extracted content (~180 words of real article body covering 3 specific decisions, with one quote)

Correct output: source_quality="thin" with a 100–250 word summary that reflects ONLY those 3 decisions and quote. Do not invent supporting context the article didn't provide; do not write a 600-word summary by inferring what the rest of the article "must have" covered.
</example>`;

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
Extracted content length: ${args.text.length} chars

---

Extracted content:

${truncated}

---

Produce the structured summary now. Remember: if the extracted content above is essentially just a headline + link (i.e. doesn't actually contain the article body), set source_quality="title_only" and describe ONLY what the tweet/headline itself says — do not infer what the linked article contains.`;
}
