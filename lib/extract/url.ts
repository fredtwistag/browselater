import type { ContentType } from "@/lib/db/types";

// Tracking params stripped during canonicalization (PRD §9.2).
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "utm_brand",
  "fbclid",
  "gclid",
  "yclid",
  "mc_cid",
  "mc_eid",
  "_hsenc",
  "_hsmi",
  "ref",
  "ref_src",
  "ref_url",
  "trk",
  "igshid",
  "spm",
  "scid",
]);

export interface CanonicalResult {
  originalUrl: string;
  canonicalUrl: string;
  domain: string;
  type: ContentType;
}

export function normalizeUrl(input: string): string {
  const url = new URL(input);
  // Lowercase host, drop default ports, drop trailing slash for non-root paths.
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  // Strip tracking params
  const cleanedParams = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) cleanedParams.append(key, value);
  }
  url.search = cleanedParams.toString();
  url.hash = "";

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}

/**
 * Resolve redirects (up to 5 hops) and normalize the final URL.
 * Falls back to GET if HEAD is not allowed by the host.
 */
export async function resolveCanonical(input: string): Promise<CanonicalResult> {
  const originalUrl = ensureProtocol(input);
  let current = originalUrl;
  let hops = 0;

  while (hops < 5) {
    const res = await fetchSafe(current, "HEAD");
    if (!res) break;
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      current = new URL(loc, current).toString();
      hops++;
      continue;
    }
    break;
  }

  const canonical = normalizeUrl(current);
  const { hostname } = new URL(canonical);
  return {
    originalUrl,
    canonicalUrl: canonical,
    domain: hostname,
    type: detectType(canonical),
  };
}

function ensureProtocol(input: string): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function fetchSafe(url: string, method: "HEAD" | "GET"): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      method,
      redirect: "manual",
      headers: { "user-agent": "BrowseLater/1.0 (+https://browselater.com)" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 405 && method === "HEAD") return fetchSafe(url, "GET");
    return res;
  } catch {
    return null;
  }
}

export function detectType(url: string): ContentType {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "generic";
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // YouTube — full and shortlinks
  if (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtu.be" ||
    host === "music.youtube.com"
  ) {
    return "youtube";
  }

  if (path.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(path)) return "image";

  // Default: assume article. Extractor will downgrade to "generic" if it cannot parse.
  return "article";
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

export function youtubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return null;
    if (host === "youtu.be") return parsed.pathname.slice(1) || null;
    if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
    if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] ?? null;
    if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] ?? null;
  } catch {
    /* ignore */
  }
  return null;
}
