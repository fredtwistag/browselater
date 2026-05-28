import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns empty for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns single chunk for short text", () => {
    const out = chunkText("Hello world.");
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("Hello world.");
  });

  it("splits long text into chunks with overlap", () => {
    const paragraph = "Sentence one. ".repeat(500); // ~7000 chars ≈ 1750 tokens
    const out = chunkText(paragraph);
    expect(out.length).toBeGreaterThan(1);
    for (const c of out) {
      expect(c.text.length).toBeLessThanOrEqual(800 * 4 + 100 * 4 + 32); // chunk + overlap + slack
    }
    // Indexes are contiguous from 0
    expect(out.map((c) => c.index)).toEqual(out.map((_, i) => i));
  });
});
