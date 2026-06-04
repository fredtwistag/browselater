export const CHAT_SYSTEM = `You are BrowseLater's research assistant. You answer questions strictly using the source snippets retrieved from the user's saved library.

Rules:
- Ground every claim in the snippets. If the snippets don't answer the question, say so plainly.
- Cite sources inline using [#] markers. Each [#] refers to the snippet order. The UI resolves them to source items.
- Be concise. Lead with the answer; supporting detail follows.
- Markdown is fine. No raw HTML.

The user keeps a personalization profile spanning five contexts: Personal, Family, Wealth, Health, and Twistag (with sub-areas Ops, Sales, DevEx, Innovation, Marketing). When the question or the source obviously touches one of these contexts, phrase the answer in terms that connect to the user's stated situation — without quoting the profile back at them.`;

/**
 * The cacheable personalization-profile prelude that anchors every chat turn.
 * Same shape as the insights prompt's profile block so the model sees a
 * consistent representation.
 */
export function chatProfileBlock(profileMd: string): string {
  return `# Personalization profile (private)\n\n${profileMd}`;
}

/**
 * Format the current user turn: retrieved snippets + the question itself.
 * The model always sees the user's actual question text — query-rewriting
 * only affects retrieval, never what the model reads.
 */
export function chatTurnContent(args: {
  snippets: Array<{ index: number; title: string; chunkText: string }>;
  question: string;
}): string {
  if (args.snippets.length === 0) {
    return `No matching snippets were found in the user's library for: "${args.question}". Tell the user this plainly.`;
  }
  const context = args.snippets
    .map((s) => `[${s.index}] ${s.title}\n${s.chunkText}`)
    .join("\n\n---\n\n");
  return `Snippets from the user's saved library:\n\n${context}\n\n---\n\nQuestion:\n${args.question}`;
}

export const QUERY_REWRITE_SYSTEM = `You convert a short follow-up question into a stand-alone search query for a vector + full-text search engine over the user's saved library.

- Output ONLY the rewritten query string. No quotes, no preamble, no explanation.
- Resolve pronouns and elisions using the conversation history ("that one" → the actual entity).
- Keep it short (≤ 12 words). Strip filler ("can you tell me about...").
- If the follow-up is already self-contained, return it unchanged.`;

export function queryRewriteUserPrompt(args: {
  history: Array<{ role: "user" | "assistant"; text: string }>;
  current: string;
}): string {
  const turns = args.history
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n");
  return `Conversation so far:\n${turns}\n\nFollow-up:\n${args.current}\n\nRewritten standalone query:`;
}

/**
 * Heuristic: does this query look like it needs the conversation context to be
 * answerable? Short, anaphoric, or starting with a continuation cue.
 */
export function looksLikeFollowUp(question: string): boolean {
  const trimmed = question.trim();
  if (trimmed.length === 0) return false;
  const tokenCount = trimmed.split(/\s+/).length;
  if (tokenCount < 8) return true;
  return /^(what about|and|also|that one|the (second|third|other|same|first)|how about|why|why not)\b/i.test(
    trimmed,
  );
}
