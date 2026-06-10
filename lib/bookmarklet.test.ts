import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";

const SECRET = "test-secret-test-secret-test-secret";

beforeAll(() => {
  process.env.BOOKMARKLET_SIGNING_SECRET = SECRET;
});

afterEach(() => vi.useRealTimers());

// Sign an arbitrary payload (not just `userId.timestamp`) with the test secret,
// so we can hand-craft malformed-but-validly-signed tokens.
function signPayload(payload: string): string {
  const mac = createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 32);
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

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

  it("rejects a token older than TOKEN_MAX_AGE_MS", async () => {
    const { signBookmarkletToken, verifyBookmarkletToken, TOKEN_MAX_AGE_MS } =
      await import("./bookmarklet");
    const userId = "00000000-0000-0000-0000-000000000001";
    const base = new Date("2025-01-01T00:00:00Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(base);
    const token = signBookmarkletToken(userId);
    vi.setSystemTime(base + TOKEN_MAX_AGE_MS + 1);
    expect(await verifyBookmarkletToken(token)).toBeNull();
  });

  it("accepts a token just under TOKEN_MAX_AGE_MS", async () => {
    const { signBookmarkletToken, verifyBookmarkletToken, TOKEN_MAX_AGE_MS } =
      await import("./bookmarklet");
    const userId = "00000000-0000-0000-0000-000000000001";
    const base = new Date("2025-01-01T00:00:00Z").getTime();
    vi.useFakeTimers();
    vi.setSystemTime(base);
    const token = signBookmarkletToken(userId);
    vi.setSystemTime(base + TOKEN_MAX_AGE_MS - 60_000);
    expect(await verifyBookmarkletToken(token)).toBe(userId);
  });

  it("fails closed on a validly-signed payload with no timestamp", async () => {
    const { verifyBookmarkletToken } = await import("./bookmarklet");
    const token = signPayload("some-user-id");
    expect(await verifyBookmarkletToken(token)).toBeNull();
  });

  it("fails closed on a validly-signed payload with a non-numeric timestamp", async () => {
    const { verifyBookmarkletToken } = await import("./bookmarklet");
    const token = signPayload("some-user-id.notanumber");
    expect(await verifyBookmarkletToken(token)).toBeNull();
  });
});
