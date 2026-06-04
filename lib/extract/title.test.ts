import { describe, it, expect } from "vitest";
import { cleanTitle } from "./title";

describe("cleanTitle", () => {
  it("strips a pipe-separated site suffix", () => {
    expect(cleanTitle("Some headline | The New York Times", "The New York Times")).toBe(
      "Some headline",
    );
  });

  it("strips a hyphen-separated site suffix", () => {
    expect(cleanTitle("How we shipped X - Stripe Engineering", "Stripe Engineering")).toBe(
      "How we shipped X",
    );
  });

  it("strips an em-dash-separated site suffix", () => {
    expect(cleanTitle("Article — Vercel Blog", "Vercel Blog")).toBe("Article");
  });

  it("strips an en-dash-separated site suffix", () => {
    expect(cleanTitle("Article – Site Name", "Site Name")).toBe("Article");
  });

  it("is case-insensitive on the site name match", () => {
    expect(cleanTitle("Title | THE GUARDIAN", "The Guardian")).toBe("Title");
  });

  it("leaves the title alone when no site name is known", () => {
    expect(cleanTitle("Article — On Em Dashes", null)).toBe("Article — On Em Dashes");
  });

  it("leaves the title alone when the suffix doesn't match", () => {
    expect(cleanTitle("Some headline | Wired", "The New York Times")).toBe("Some headline | Wired");
  });

  it("doesn't strip a separator that isn't followed by the site", () => {
    expect(cleanTitle("Apples — and oranges", "Site Name")).toBe("Apples — and oranges");
  });

  it("returns null for null input", () => {
    expect(cleanTitle(null, "Anything")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(cleanTitle("", "Anything")).toBeNull();
  });

  it("guards against trimming to near-empty", () => {
    // If the site name eats almost the whole title, keep the original.
    expect(cleanTitle("X | The New York Times", "The New York Times")).toBe(
      "X | The New York Times",
    );
  });

  it("handles regex-special characters in site name", () => {
    expect(cleanTitle("Headline | A+B Co.", "A+B Co.")).toBe("Headline");
  });
});
