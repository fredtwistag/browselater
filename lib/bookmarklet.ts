import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.BOOKMARKLET_SIGNING_SECRET;
  if (!s) throw new Error("BOOKMARKLET_SIGNING_SECRET not set");
  return s;
}

export function signBookmarkletToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const mac = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export async function verifyBookmarkletToken(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64, mac] = parts;
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [userId] = payload.split(".");
  return userId || null;
}

export function bookmarkletSnippet(siteUrl: string, token: string): string {
  // Minified bookmarklet. Opens the save endpoint in a small popup that auto-closes.
  return `javascript:(function(){var u=encodeURIComponent(location.href);var w=window.open('${siteUrl}/api/bookmarklet?t=${token}&u='+u,'bl','width=420,height=200');})();`;
}
