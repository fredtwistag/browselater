/**
 * Recursive character splitter — 800-token target, 100-token overlap (PRD §9.3).
 *
 * We approximate tokens by characters (1 token ≈ 4 chars for English). This is
 * close enough for Voyage/Claude embedding chunking and avoids dragging in a tokenizer.
 */

const CHARS_PER_TOKEN = 4;
const DEFAULT_CHUNK_TOKENS = 800;
const DEFAULT_OVERLAP_TOKENS = 100;

const SEPARATORS = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""];

export interface Chunk {
  index: number;
  text: string;
  tokens: number;
}

export function chunkText(
  raw: string,
  opts: { chunkTokens?: number; overlapTokens?: number } = {},
): Chunk[] {
  const chunkTokens = opts.chunkTokens ?? DEFAULT_CHUNK_TOKENS;
  const overlapTokens = opts.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const chunkChars = chunkTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const pieces = splitRecursive(text, chunkChars, SEPARATORS);
  const chunks: Chunk[] = [];
  let buffer = "";
  let idx = 0;

  for (const piece of pieces) {
    if ((buffer + piece).length > chunkChars && buffer.length > 0) {
      chunks.push({
        index: idx++,
        text: buffer.trim(),
        tokens: Math.round(buffer.length / CHARS_PER_TOKEN),
      });
      const tail = buffer.slice(Math.max(0, buffer.length - overlapChars));
      buffer = tail + piece;
    } else {
      buffer += piece;
    }
  }
  if (buffer.trim().length > 0) {
    chunks.push({
      index: idx++,
      text: buffer.trim(),
      tokens: Math.round(buffer.length / CHARS_PER_TOKEN),
    });
  }
  return chunks;
}

function splitRecursive(text: string, target: number, seps: string[]): string[] {
  if (text.length <= target) return [text];
  const [sep, ...rest] = seps;
  if (sep === undefined) return [text];

  if (sep === "") {
    // Hard character split as last resort
    const out: string[] = [];
    for (let i = 0; i < text.length; i += target) out.push(text.slice(i, i + target));
    return out;
  }

  const parts = text.split(sep);
  if (parts.length === 1) return splitRecursive(text, target, rest);

  const reattached: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    reattached.push(p + (i < parts.length - 1 ? sep : ""));
  }
  const out: string[] = [];
  for (const piece of reattached) {
    if (piece.length <= target) out.push(piece);
    else out.push(...splitRecursive(piece, target, rest));
  }
  return out;
}
