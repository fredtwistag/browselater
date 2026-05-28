import { describe, expect, it } from "vitest";
import { youtubeVideoId } from "./url";

describe("youtubeVideoId edge cases", () => {
  it("returns null for non-YouTube URLs", () => {
    expect(youtubeVideoId("https://example.com/watch?v=x")).toBeNull();
  });
  it("handles m.youtube.com", () => {
    expect(youtubeVideoId("https://m.youtube.com/watch?v=abc")).toBe("abc");
  });
});
