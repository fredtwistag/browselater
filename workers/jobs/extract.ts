import { createServiceClient } from "@/lib/supabase/service";
import { logEvent } from "@/lib/events";
import { log } from "@/lib/log";
import { captureError } from "@/lib/errors";
import { extractArticle } from "@/lib/extract/article";
import { extractYouTube } from "@/lib/extract/youtube";
import { extractPdf } from "@/lib/extract/pdf";
import { extractImage } from "@/lib/extract/image";
import { runAiPipeline } from "@/workers/jobs/ai";
import type { ContentType } from "@/lib/db/types";

export interface ExtractInput {
  itemId: string;
  userId: string;
}

export interface ExtractedContent {
  title?: string | null;
  author?: string | null;
  publishedAt?: string | null;
  heroImageUrl?: string | null;
  heroImageAlt?: string | null;
  rawText?: string | null;
  htmlSnapshot?: string | null;
  transcriptJson?: unknown;
  pdfStorageKey?: string | null;
  imageStorageKey?: string | null;
  readTimeMinutes?: number | null;
  isPaywalled?: boolean;
  effectiveType?: ContentType;
}

export async function runExtractPipeline({ itemId, userId }: ExtractInput): Promise<void> {
  const supabase = createServiceClient();

  const { data: item, error } = await supabase
    .from("items")
    .select("id, user_id, canonical_url, original_url, type")
    .eq("id", itemId)
    .single();
  if (error || !item) {
    log.error("extract.item_not_found", { itemId, err: error?.message });
    return;
  }

  await supabase.from("items").update({ status: "extracting" }).eq("id", itemId);
  await logEvent("extract.started", userId, { itemId, type: item.type });

  let result: ExtractedContent | null = null;
  let failureReason: string | null = null;

  try {
    switch (item.type) {
      case "article":
        result = await extractArticle(item.canonical_url, userId);
        break;
      case "youtube":
        result = await extractYouTube(item.canonical_url, userId);
        break;
      case "pdf":
        result = await extractPdf(item.canonical_url, userId);
        break;
      case "image":
        result = await extractImage(item.canonical_url, userId);
        break;
      case "generic":
        result = await extractArticle(item.canonical_url, userId);
        break;
    }
  } catch (err) {
    failureReason = err instanceof Error ? err.message : String(err);
    await captureError("worker.extract", err, { itemId, type: item.type }, userId);
  }

  if (!result) {
    await supabase
      .from("items")
      .update({ status: "failed", error_message: failureReason ?? "extraction returned null" })
      .eq("id", itemId);
    await logEvent("extract.failed", userId, { itemId, reason: failureReason });
    return;
  }

  // Persist extracted metadata on items + raw content row
  await supabase
    .from("items")
    .update({
      title: result.title ?? null,
      author: result.author ?? null,
      published_at: result.publishedAt ?? null,
      hero_image_url: result.heroImageUrl ?? null,
      hero_image_alt: result.heroImageAlt ?? null,
      read_time_minutes: result.readTimeMinutes ?? null,
      is_paywalled: result.isPaywalled ?? false,
      type: result.effectiveType ?? item.type,
      status: "ready",
    })
    .eq("id", itemId);

  await supabase.from("item_content").upsert({
    item_id: itemId,
    raw_text: result.rawText ?? null,
    html_snapshot_key: result.htmlSnapshot ? `${userId}/${itemId}.html` : null,
    transcript_json: result.transcriptJson ?? null,
    pdf_storage_key: result.pdfStorageKey ?? null,
    image_storage_key: result.imageStorageKey ?? null,
  });

  if (result.htmlSnapshot) {
    await supabase.storage
      .from("html-snapshots")
      .upload(`${userId}/${itemId}.html`, result.htmlSnapshot, {
        upsert: true,
        contentType: "text/html; charset=utf-8",
      });
  }

  await logEvent("extract.succeeded", userId, {
    itemId,
    textLen: result.rawText?.length ?? 0,
    paywalled: result.isPaywalled ?? false,
  });

  // Kick AI pipeline
  if (result.rawText && result.rawText.length > 200) {
    await runAiPipeline({ itemId, userId });
  } else {
    log.info("extract.skip_ai_short_text", { itemId, len: result.rawText?.length ?? 0 });
  }
}
