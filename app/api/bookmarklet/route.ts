import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveCanonical } from "@/lib/extract/url";
import { enqueueExtract } from "@/workers/queue";
import { verifyBookmarkletToken } from "@/lib/bookmarklet";
import { logEvent } from "@/lib/events";

/**
 * Bookmarklet endpoint. Uses a per-user signed token (NOT a session cookie),
 * because bookmarklets fire from arbitrary origins and shouldn't ride session auth.
 *
 * The token is created in Settings → Bookmarklet and embedded in the bookmarklet
 * source: `javascript:fetch('https://.../api/bookmarklet?u='+encodeURIComponent(location.href)+'&t=<token>')`.
 */

const querySchema = z.object({
  u: z.string().min(4).max(2048),
  t: z
    .string()
    .min(40)
    .max(256)
    .regex(/^[A-Za-z0-9_-]+\.[0-9a-f]{32}$/),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    u: url.searchParams.get("u") ?? "",
    t: url.searchParams.get("t") ?? "",
  });
  if (!parsed.success) return badRequest("missing params");

  const userId = await verifyBookmarkletToken(parsed.data.t);
  if (!userId) return new NextResponse("invalid token", { status: 401 });

  let canonical;
  try {
    canonical = await resolveCanonical(parsed.data.u);
  } catch {
    return badRequest("could not resolve url");
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("items")
    .select("id")
    .eq("user_id", userId)
    .eq("canonical_url", canonical.canonicalUrl)
    .is("deleted_at", null)
    .maybeSingle();

  let itemId = existing?.id;
  if (!itemId) {
    const { data: created, error } = await supabase
      .from("items")
      .insert({
        user_id: userId,
        original_url: canonical.originalUrl,
        canonical_url: canonical.canonicalUrl,
        type: canonical.type,
        source_domain: canonical.domain,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !created) return new NextResponse("insert failed", { status: 500 });
    itemId = created.id;
    await enqueueExtract({ itemId, userId });
    await logEvent("save.submitted", userId, { itemId, type: canonical.type, via: "bookmarklet" });
  } else {
    await logEvent("save.duplicate", userId, { itemId, via: "bookmarklet" });
  }

  // Return a tiny HTML page that confirms and closes itself (popup) or shows OK if used inline.
  return new NextResponse(htmlConfirm(itemId, !!existing), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function badRequest(msg: string) {
  return new NextResponse(msg, { status: 400 });
}

function htmlConfirm(itemId: string, duplicate: boolean) {
  const label = duplicate ? "Already saved" : "Saved to BrowseLater";
  return `<!doctype html><meta charset="utf-8"><title>${label}</title>
<style>body{font-family:system-ui;padding:24px;max-width:420px}a{color:#1d4ed8}</style>
<h2>${label}</h2>
<p>Item <code>${itemId}</code>.</p>
<p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/item/${itemId}" target="_blank">Open detail page →</a></p>
<script>setTimeout(()=>window.close(), 2500);</script>`;
}
