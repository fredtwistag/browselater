import { createServiceClient } from "@/lib/supabase/service";
import { estimateReadTimeMinutes } from "@/lib/utils";
import { log } from "@/lib/log";
import { assertPublicUrl, PrivateUrlError } from "@/lib/extract/url-guard";
import type { ExtractedContent } from "@/workers/jobs/extract";

export async function extractPdf(url: string, userId: string): Promise<ExtractedContent | null> {
  try {
    assertPublicUrl(url);
  } catch (err) {
    if (err instanceof PrivateUrlError) {
      log.warn("pdf.private_url", { url });
      return null;
    }
    throw err;
  }

  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    log.warn("pdf.http_error", { url, status: res.status });
    return null;
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = (await import("pdf-parse")).default;
  const parsed = await pdfParse(buffer);

  // Store original PDF
  const supabase = createServiceClient();
  const key = `${userId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("pdfs")
    .upload(key, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadError) log.warn("pdf.upload_failed", { err: uploadError.message });

  // Title heuristic: first non-empty line under 200 chars
  const firstLine = parsed.text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && l.length < 200);

  return {
    title: parsed.info?.Title?.trim() || firstLine || "PDF",
    author: parsed.info?.Author?.trim() || null,
    rawText: parsed.text.slice(0, 200_000),
    pdfStorageKey: uploadError ? null : key,
    readTimeMinutes: estimateReadTimeMinutes(parsed.text),
    effectiveType: "pdf",
    isPaywalled: false,
  };
}
