import { log } from "@/lib/log";
import type { ExtractedContent } from "@/workers/jobs/extract";

/**
 * Twitter / X extractor.
 *
 * Uses Twitter's public syndication endpoint (the same one their oembed widget hits).
 * No auth required, returns tweet text + author + media.
 *
 * URL formats we handle:
 *   https://twitter.com/<user>/status/<id>
 *   https://x.com/<user>/status/<id>
 *   https://twitter.com/i/web/status/<id>
 */

const TWITTER_HOSTS = new Set(["twitter.com", "www.twitter.com", "x.com", "www.x.com"]);

export function isTwitterUrl(url: string): boolean {
  try {
    return TWITTER_HOSTS.has(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function tweetIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // /<user>/status/<id> or /i/web/status/<id>
    const m = parsed.pathname.match(/\/status\/(\d+)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

interface SyndicationResponse {
  text: string;
  user: { name: string; screen_name: string };
  created_at: string;
  mediaDetails?: Array<{ media_url_https: string; type: string }>;
  photos?: Array<{ url: string }>;
  video?: { poster?: string };
  // The syndication endpoint also returns expanded entities with the resolved URL
  // for every t.co link in the tweet body.
  entities?: {
    urls?: Array<{ url: string; expanded_url: string; display_url?: string }>;
  };
}

export async function extractTwitter(
  url: string,
  _userId: string,
): Promise<ExtractedContent | null> {
  const id = tweetIdFromUrl(url);
  if (!id) {
    log.warn("twitter.no_id", { url });
    return null;
  }

  // The syndication endpoint requires a `token` query param derived from the tweet id.
  // The known algorithm is `((id * 1e-15) * Math.PI).toString(36).replace(/(0+|\.)/g, "")`.
  const token = computeSyndicationToken(id);
  const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${token}&lang=en`;

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; BrowseLater/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    log.warn("twitter.fetch_failed", { id, err: err instanceof Error ? err.message : String(err) });
    return null;
  }

  if (!res.ok) {
    log.warn("twitter.http_error", { id, status: res.status });
    return null;
  }

  const data = (await res.json()) as SyndicationResponse;
  if (!data?.text) {
    log.warn("twitter.empty_response", { id });
    return null;
  }

  const author = data.user?.name
    ? `${data.user.name} (@${data.user.screen_name})`
    : data.user?.screen_name
      ? `@${data.user.screen_name}`
      : null;

  const heroImage =
    data.mediaDetails?.find((m) => m.type === "photo")?.media_url_https ??
    data.photos?.[0]?.url ??
    data.video?.poster ??
    null;

  // Most "headline + link" tweets carry the actual content behind a t.co URL.
  // Resolve and fetch the first link that points to a real article (skip image/video CDNs,
  // self-links to twitter, and well-known shorteners we'd loop on).
  const expandedText = await maybeAppendLinkedArticle(data, url);

  return {
    title: truncateTitle(data.text),
    author,
    publishedAt: data.created_at ?? null,
    heroImageUrl: heroImage,
    heroImageAlt: data.text.slice(0, 200),
    rawText: expandedText,
    effectiveType: "article",
    isPaywalled: false,
  };
}

async function maybeAppendLinkedArticle(
  data: SyndicationResponse,
  sourceUrl: string,
): Promise<string> {
  const urls = data.entities?.urls ?? [];
  // Take only outbound links — skip self-references back to the tweet/thread.
  const outbound = urls
    .map((u) => u.expanded_url)
    .filter((u) => {
      try {
        const h = new URL(u).hostname.toLowerCase();
        if (h.includes("twitter.com") || h.includes("x.com")) return false;
        // Skip CDNs / media direct links
        if (h.includes("pbs.twimg.com") || h.includes("video.twimg.com")) return false;
        return true;
      } catch {
        return false;
      }
    });

  if (outbound.length === 0) return data.text;

  // Pick the first outbound link; fetch + extract its readable body.
  const target = outbound[0];
  try {
    const articleText = await fetchReadableBody(target);
    if (!articleText || articleText.length < 200) {
      log.info("twitter.linked_thin", { tweet: sourceUrl, target, len: articleText?.length ?? 0 });
      return data.text;
    }
    log.info("twitter.linked_appended", { tweet: sourceUrl, target, len: articleText.length });
    return `${data.text}\n\n---\n\nLINKED ARTICLE (${target}):\n\n${articleText}`;
  } catch (err) {
    log.warn("twitter.linked_fetch_failed", {
      target,
      err: err instanceof Error ? err.message : String(err),
    });
    return data.text;
  }
}

async function fetchReadableBody(url: string): Promise<string | null> {
  // Lazy import so non-Twitter code paths don't pull jsdom/Readability transitively.
  const { Readability } = await import("@mozilla/readability");
  const { JSDOM } = await import("jsdom");
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const parsed = new Readability(dom.window.document).parse();
  return parsed?.textContent?.trim().slice(0, 60_000) ?? null;
}

function truncateTitle(text: string): string {
  const firstLine = text.split("\n")[0].trim();
  if (firstLine.length <= 120) return firstLine;
  return firstLine.slice(0, 117) + "…";
}

function computeSyndicationToken(id: string): string {
  // Twitter's public widgets compute this token client-side; algorithm is:
  // ((parseFloat(id) / 1e15) * Math.PI).toString(6 ** 2).replace(/(0+|\.)/g, "")
  const n = (parseFloat(id) / 1e15) * Math.PI;
  return n.toString(36).replace(/(0+|\.)/g, "");
}
