import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.BOOKMARKLET_SIGNING_SECRET = "test-secret-test-secret-test-secret";
});

describe("bookmarklet token", () => {
  it("round-trips for the same user", async () => {
    const { signBookmarkletToken, verifyBookmarkletToken } = await import("./bookmarklet");
    const userId = "00000000-0000-0000-0000-000000000001";
    const token = signBookmarkletToken(userId);
    const verified = await verifyBookmarkletToken(token);
    expect(verified).toBe(userId);
  });

  it("rejects tampered token", async () => {
    const { signBookmarkletToken, verifyBookmarkletToken } = await import("./bookmarklet");
    const token = signBookmarkletToken("u");
    const tampered = token.slice(0, -2) + "00";
    expect(await verifyBookmarkletToken(tampered)).toBeNull();
  });
});
