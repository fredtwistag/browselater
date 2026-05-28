import { streamText, StreamData, type CoreMessage } from "ai";
import { requireUser, createClient } from "@/lib/supabase/server";
import { sonnet } from "@/lib/ai/claude";
import { embedQuery } from "@/lib/ai/embeddings";
import { createServiceClient } from "@/lib/supabase/service";
import { logEvent } from "@/lib/events";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHAT_SYSTEM = `You are BrowseLater's research assistant. You answer questions strictly using the source snippets retrieved from the user's saved library. Rules:
- Ground every claim in the snippets. If the snippets don't answer the question, say so plainly.
- Cite sources inline using [#] markers. Each [#] refers to the snippet order. The UI resolves them to source items.
- Be concise. Lead with the answer; supporting detail follows.
- Markdown is fine. No raw HTML.`;

interface ChatRequest {
  messages: CoreMessage[];
}

export async function POST(request: Request) {
  const user = await requireUser();
  const body = (await request.json()) as ChatRequest;

  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  const question =
    typeof lastUser?.content === "string"
      ? lastUser.content
      : Array.isArray(lastUser?.content)
        ? lastUser?.content.map((p) => ("text" in p ? p.text : "")).join(" ")
        : "";

  await logEvent("chat.query", user.id, { len: question.length });

  const retrieved = await retrieve(user.id, question);

  const data = new StreamData();
  data.append({
    sources: retrieved.map((r, i) => ({
      index: i + 1,
      id: r.item_id,
      title: r.title,
      url: r.url,
    })),
  });

  const contextBlock = retrieved
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.chunk_text}`)
    .join("\n\n---\n\n");

  const augmentedMessages: CoreMessage[] = [
    {
      role: "user",
      content:
        retrieved.length === 0
          ? `No matching snippets were found in the user's library for: "${question}". Tell the user this plainly.`
          : `Snippets from the user's saved library:\n\n${contextBlock}\n\n---\n\nQuestion:\n${question}`,
    },
  ];

  const result = streamText({
    model: sonnet(),
    system: CHAT_SYSTEM,
    messages: augmentedMessages,
    onFinish: () => {
      data.close();
    },
  });

  return result.toDataStreamResponse({ data });
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
