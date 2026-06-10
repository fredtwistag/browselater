import { createServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/log";
import { assertPublicUrl, PrivateUrlError } from "@/lib/extract/url-guard";
import type { ExtractedContent } from "@/workers/jobs/extract";

export async function extractImage(url: string, userId: string): Promise<ExtractedContent | null> {
  try {
    assertPublicUrl(url);
  } catch (err) {
    if (err instanceof PrivateUrlError) {
      log.warn("image.private_url", { url });
      return null;
    }
    throw err;
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    log.warn("image.http_error", { url, status: res.status });
    return null;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const ext = (contentType.split("/")[1] ?? "jpg").split(";")[0];

  // Thumbnail with sharp
  let thumbnailBuf: Buffer | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharp = (await import("sharp")).default;
    thumbnailBuf = await sharp(buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (err) {
    log.warn("image.sharp_failed", { err: err instanceof Error ? err.message : String(err) });
  }

  const supabase = createServiceClient();
  const id = crypto.randomUUID();
  const origKey = `${userId}/${id}-orig.${ext}`;
  const thumbKey = `${userId}/${id}-thumb.webp`;

  const { error: origErr } = await supabase.storage
    .from("images")
    .upload(origKey, buffer, { contentType, upsert: false });
  if (origErr) log.warn("image.upload_orig_failed", { err: origErr.message });

  if (thumbnailBuf) {
    await supabase.storage
      .from("images")
      .upload(thumbKey, thumbnailBuf, { contentType: "image/webp", upsert: false })
      .then(({ error }) => {
        if (error) log.warn("image.upload_thumb_failed", { err: error.message });
      });
  }

  return {
    title: new URL(url).pathname.split("/").pop() ?? "Image",
    heroImageUrl: url,
    imageStorageKey: origErr ? null : origKey,
    rawText: `Image saved from ${url}`,
    effectiveType: "image",
    isPaywalled: false,
  };
}
