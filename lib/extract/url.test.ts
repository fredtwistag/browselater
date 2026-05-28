import { describe, expect, it } from "vitest";
import { normalizeUrl, detectType, youtubeVideoId } from "./url";

describe("normalizeUrl", () => {
  it("strips utm_* and other tracker params", () => {
    expect(normalizeUrl("https://example.com/post?utm_source=x&id=42&fbclid=abc")).toBe(
      "https://example.com/post?id=42",
    );
  });

  it("lowercases host and drops fragments", () => {
    expect(normalizeUrl("HTTPS://Example.COM/Path#frag")).toBe("https://example.com/Path");
  });

  it("trims trailing slashes from non-root paths", () => {
    expect(normalizeUrl("https://example.com/foo/bar/")).toBe("https://example.com/foo/bar");
  });

  it("preserves trailing slash on root", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });
});

describe("detectType", () => {
  it("detects YouTube long and short", () => {
    expect(detectType("https://www.youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectType("https://youtu.be/abc")).toBe("youtube");
    expect(detectType("https://www.youtube.com/shorts/abc")).toBe("youtube");
  });

  it("detects PDF by extension", () => {
    expect(detectType("https://example.com/paper.pdf")).toBe("pdf");
  });

  it("detects image extensions", () => {
    expect(detectType("https://example.com/img.jpg")).toBe("image");
    expect(detectType("https://example.com/img.webp")).toBe("image");
  });

  it("falls back to article", () => {
    expect(detectType("https://example.com/post")).toBe("article");
  });
});

describe("youtubeVideoId", () => {
  it("extracts from /watch?v=", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts from youtu.be", () => {
    expect(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts from shorts", () => {
    expect(youtubeVideoId("https://www.youtube.com/shorts/abc123")).toBe("abc123");
  });
});
