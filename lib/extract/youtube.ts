import { log } from "@/lib/log";
import { youtubeVideoId } from "@/lib/extract/url";
import type { ExtractedContent } from "@/workers/jobs/extract";

/**
 * YouTube transcript scrape (PRD §9.1, F-5).
 *
 * We use Playwright to load the video page, expand the description, and click the
 * "Show transcript" button. This is the page-scrape approach — no paid 3rd-party service.
 *
 * Playwright is a heavy dep for serverless. On Vercel, we run this in the worker
 * route with maxDuration=300. If launch fails (eg locally on first run), the caller
 * gets a stub with metadata only.
 */
export async function extractYouTube(
  url: string,
  _userId: string,
): Promise<ExtractedContent | null> {
  const videoId = youtubeVideoId(url);
  if (!videoId) {
    log.warn("youtube.no_id", { url });
    return null;
  }

  // First: cheap metadata via noembed (no auth required, just an oEmbed-style endpoint)
  const meta = await fetchMeta(videoId);

  const transcript = await scrapeTranscript(videoId).catch((err) => {
    log.warn("youtube.scrape_failed", {
      videoId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  });

  if (!transcript || transcript.lines.length === 0) {
    return {
      title: meta.title,
      author: meta.author,
      heroImageUrl: meta.thumbnail,
      effectiveType: "youtube",
      rawText: meta.title ? `[no transcript]\n\n${meta.title}` : null,
      isPaywalled: false,
    };
  }

  const fullText = transcript.lines.map((l) => l.text).join(" ");
  return {
    title: meta.title,
    author: meta.author,
    heroImageUrl: meta.thumbnail,
    rawText: fullText.slice(0, 200_000),
    transcriptJson: transcript.lines,
    readTimeMinutes: Math.max(1, Math.round(transcript.durationSec / 60)),
    effectiveType: "youtube",
    isPaywalled: false,
  };
}

async function fetchMeta(videoId: string) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      {
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return { title: null, author: null, thumbnail: thumbUrl(videoId) };
    const json = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      title: json.title ?? null,
      author: json.author_name ?? null,
      thumbnail: json.thumbnail_url ?? thumbUrl(videoId),
    };
  } catch {
    return { title: null, author: null, thumbnail: thumbUrl(videoId) };
  }
}

function thumbUrl(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

interface TranscriptLine {
  start: number;
  text: string;
}

/**
 * Playwright-based transcript scrape.
 * Loaded dynamically so we don't pull Playwright into the bundle if this code path
 * isn't exercised (e.g. dev requests for non-YouTube URLs).
 */
async function scrapeTranscript(
  videoId: string,
): Promise<{ lines: TranscriptLine[]; durationSec: number } | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      locale: "en-US",
    });
    const page = await context.newPage();
    await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Dismiss consent if present
    await page
      .locator('button:has-text("Accept all"), button:has-text("I agree")')
      .first()
      .click({ timeout: 2000 })
      .catch(() => {});

    // Expand description
    await page
      .locator("#expand")
      .first()
      .click({ timeout: 5000 })
      .catch(() => {});

    // Click "Show transcript"
    const transcriptBtn = page
      .locator('button:has-text("Show transcript"), tp-yt-paper-button:has-text("Show transcript")')
      .first();
    await transcriptBtn.waitFor({ state: "visible", timeout: 10_000 });
    await transcriptBtn.click();

    // Wait for transcript renderer
    await page.locator("ytd-transcript-segment-renderer").first().waitFor({ timeout: 10_000 });

    const lines = await page.locator("ytd-transcript-segment-renderer").evaluateAll((els) =>
      els
        .map((el) => {
          const t = el.querySelector(".segment-timestamp")?.textContent?.trim();
          const text = el.querySelector(".segment-text")?.textContent?.trim() ?? "";
          return { t, text };
        })
        .filter((l) => l.text.length > 0),
    );

    const parsed: TranscriptLine[] = lines.map(({ t, text }) => ({
      start: parseTimestamp(t ?? "0:00"),
      text,
    }));
    const durationSec = parsed.length ? parsed[parsed.length - 1].start : 0;
    return { lines: parsed, durationSec };
  } finally {
    await browser.close();
  }
}

function parseTimestamp(ts: string): number {
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}
