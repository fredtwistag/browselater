import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";
import { resolveCanonical } from "@/lib/extract/url";
import { enqueueExtract } from "@/workers/queue";
import { logEvent } from "@/lib/events";
import { log } from "@/lib/log";

const saveSchema = z.object({
  url: z.string().min(4).max(2048),
});

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  let canonical;
  try {
    canonical = await resolveCanonical(parsed.data.url);
  } catch (err) {
    log.error("save.canonical_failed", {
      url: parsed.data.url,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Could not resolve URL" }, { status: 400 });
  }

  const supabase = await createClient();

  // Dedupe on canonical_url per user
  const { data: existing } = await supabase
    .from("items")
    .select("id")
    .eq("user_id", user.id)
    .eq("canonical_url", canonical.canonicalUrl)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    await logEvent("save.duplicate", user.id, { itemId: existing.id });
    return NextResponse.json({ id: existing.id, duplicate: true });
  }

  const { data: created, error: insertError } = await supabase
    .from("items")
    .insert({
      user_id: user.id,
      original_url: canonical.originalUrl,
      canonical_url: canonical.canonicalUrl,
      type: canonical.type,
      source_domain: canonical.domain,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !created) {
    log.error("save.insert_failed", { err: insertError?.message });
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }

  await logEvent("save.submitted", user.id, { itemId: created.id, type: canonical.type });

  // Fire-and-forget; the worker is invoked via Vercel Queues in prod and inline in dev.
  enqueueExtract({ itemId: created.id, userId: user.id }).catch((err) => {
    log.error("save.enqueue_failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return NextResponse.json({ id: created.id, duplicate: false });
}
