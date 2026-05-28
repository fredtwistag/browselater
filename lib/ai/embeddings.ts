import { log } from "@/lib/log";

/**
 * Embeddings via Voyage AI (voyage-3, 1024-dim). Anthropic does not provide an
 * embeddings endpoint; Voyage is Anthropic's recommended partner. Swap providers
 * here without touching the rest of the pipeline.
 *
 * If VOYAGE_API_KEY is missing, embeddings are skipped and search degrades to FTS only.
 */

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3";

export interface EmbeddingResult {
  vector: number[];
}

export async function embedBatch(inputs: string[]): Promise<EmbeddingResult[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    log.warn("embed.skip_no_key");
    return null;
  }
  if (inputs.length === 0) return [];

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: inputs,
      input_type: "document",
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    log.error("embed.http_error", { status: res.status });
    return null;
  }
  const json = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  const sorted = json.data.sort((a, b) => a.index - b.index);
  return sorted.map((d) => ({ vector: d.embedding }));
}

export async function embedQuery(query: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      input: [query],
      input_type: "query",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0]?.embedding ?? null;
}
