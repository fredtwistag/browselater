import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { estimateReadTimeMinutes } from "@/lib/utils";
import { log } from "@/lib/log";
import { isTwitterUrl, extractTwitter } from "@/lib/extract/twitter";
import { cleanTitle } from "@/lib/extract/title";
import { assertPublicUrl, PrivateUrlError } from "@/lib/extract/url-guard";
import type { ExtractedContent } from "@/workers/jobs/extract";

// Paywall heuristics — sites that block extraction even if HTTP 200 comes back
const PAYWALL_MARKERS = [
  "subscribe to continue",
  "subscribe to read",
  "to continue reading",
  "this article is for subscribers",
  "you have reached your article limit",
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export async function extractArticle(
  url: string,
  userId: string,
): Promise<ExtractedContent | null> {
  // Twitter / X tweets are JS-rendered; Readability sees an empty body.
  // Route them through the syndication API extractor instead.
  if (isTwitterUrl(url)) {
    const tweet = await extractTwitter(url, userId);
    if (tweet) return tweet;
    log.info("twitter.fallback_to_readability", { url });
    // fall through if the syndication endpoint failed
  }

  try {
    assertPublicUrl(url);
  } catch (err) {
    if (err instanceof PrivateUrlError) {
      log.warn("article.private_url", { url });
      return null;
    }
    throw err;
  }

  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    log.warn("article.http_error", { url, status: res.status });
    return paywalledStub(url, `HTTP ${res.status}`);
  }
  const html = await res.text();

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const parsed = reader.parse();

  const lower = html.toLowerCase();
  const isPaywalled = PAYWALL_MARKERS.some((m) => lower.includes(m));

  const siteName =
    dom.window.document.querySelector('meta[property="og:site_name"]')?.getAttribute("content") ??
    null;

  if (!parsed || !parsed.textContent || parsed.textContent.length < 300) {
    log.info("article.parse_thin", { url, len: parsed?.textContent?.length ?? 0 });
    if (isPaywalled) {
      return paywalledStub(url, "paywall detected");
    }
    // Fallback: pluck OG tags + body text
    const doc = dom.window.document;
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
    const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute("content");
    const description = doc.querySelector('meta[name="description"]')?.getAttribute("content");
    const fallbackText = parsed?.textContent ?? doc.body?.textContent ?? description ?? "";
    return {
      title: cleanTitle(ogTitle ?? doc.title ?? null, siteName),
      heroImageUrl: ogImage ?? null,
      rawText: fallbackText.trim().slice(0, 50_000),
      htmlSnapshot: html.slice(0, 2_000_000),
      readTimeMinutes: estimateReadTimeMinutes(fallbackText),
      effectiveType: "generic",
      isPaywalled,
    };
  }

  const doc = dom.window.document;
  const ogImage =
    doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ??
    doc.querySelector('meta[name="twitter:image"]')?.getAttribute("content");
  const heroAlt = pickHeroAlt(doc, parsed.title);
  const publishedMeta =
    doc.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ??
    doc.querySelector("time[datetime]")?.getAttribute("datetime");

  return {
    title: cleanTitle(parsed.title, siteName),
    author: parsed.byline ?? null,
    publishedAt: publishedMeta ?? null,
    heroImageUrl: ogImage ?? null,
    heroImageAlt: heroAlt,
    rawText: parsed.textContent.trim().slice(0, 80_000),
    htmlSnapshot: html.slice(0, 2_000_000),
    readTimeMinutes: estimateReadTimeMinutes(parsed.textContent),
    effectiveType: "article",
    isPaywalled,
  };
}

function pickHeroAlt(doc: Document, title: string | null | undefined): string | null {
  const ogAlt =
    doc.querySelector('meta[property="og:image:alt"]')?.getAttribute("content") ??
    doc.querySelector('meta[name="twitter:image:alt"]')?.getAttribute("content");
  if (ogAlt && ogAlt.trim()) return ogAlt.trim();

  // Try the first reasonably large img inside an <article> or <main> tag.
  const candidate = doc.querySelector(
    "article img[alt]:not([alt='']), main img[alt]:not([alt=''])",
  ) as HTMLImageElement | null;
  if (candidate?.alt) return candidate.alt.trim();

  return title?.trim() ?? null;
}

function paywalledStub(url: string, reason: string): ExtractedContent {
  return {
    title: new URL(url).hostname,
    rawText: `Paywalled or unavailable: ${reason}`,
    isPaywalled: true,
    effectiveType: "article",
  };
}
