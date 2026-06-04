"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { enqueueExtract } from "@/workers/queue";
import { logEvent } from "@/lib/events";
import { log } from "@/lib/log";
import { captureError } from "@/lib/errors";
import { getLatestProfile } from "@/lib/ai/profile";
import { generateInsights } from "@/workers/jobs/ai";
import type { Feedback } from "@/lib/db/types";

export async function recordInsightFeedback({
  itemId,
  cardId,
  feedback,
}: {
  itemId: string;
  cardId: string;
  feedback: Feedback;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("insight_cards").update({ user_feedback: feedback }).eq("id", cardId);
  await logEvent("insight.feedback", user.id, { itemId, cardId, feedback });
  revalidatePath(`/item/${itemId}`);
}

export async function saveItemNotes({ itemId, notes }: { itemId: string; notes: string }) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("items")
    .update({ user_notes: notes } as never)
    .eq("id", itemId)
    .eq("user_id", user.id);
  return { ok: true };
}

export async function archiveItem(itemId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", user.id);
  revalidatePath("/feed");
  revalidatePath(`/item/${itemId}`);
}

export async function unarchiveItem(itemId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("items")
    .update({ archived_at: null })
    .eq("id", itemId)
    .eq("user_id", user.id);
  revalidatePath("/feed");
  revalidatePath(`/item/${itemId}`);
}

export async function deleteItem(itemId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", user.id);
  revalidatePath("/feed");
}

export async function rerunAi(itemId: string) {
  const user = await requireUser();
  await logEvent("ai.rerun", user.id, { itemId });
  await enqueueExtract({ itemId, userId: user.id });
  revalidatePath(`/item/${itemId}`);
}

/**
 * Re-run ONLY the insights step against the latest summary + current profile.
 * Use this when the user edits their personalization profile and wants new
 * cards without re-extracting or re-summarizing the source. Bumps
 * insight_cards.version; leaves item_ai untouched.
 *
 * Returns the new card count, or { skipped: "..." } when there's nothing to
 * regenerate against.
 */
export async function regenerateInsights(
  itemId: string,
): Promise<{ ok: true; cardCount: number } | { ok: false; skipped: string }> {
  const user = await requireUser();
  const supabase = createServiceClient();

  const { data: ownerCheck } = await supabase
    .from("items")
    .select("id, user_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!ownerCheck || ownerCheck.user_id !== user.id) {
    return { ok: false, skipped: "not_owner" };
  }

  const { data: ai } = await supabase
    .from("item_ai")
    .select("summary_md, takeaways_md, primary_context, source_quality")
    .eq("item_id", itemId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ai || !ai.summary_md) {
    return { ok: false, skipped: "no_summary" };
  }
  if (ai.source_quality === "title_only") {
    return { ok: false, skipped: "title_only" };
  }

  const profileMd = await getLatestProfile(user.id);

  await logEvent("ai.insights.started", user.id, { itemId, regenerate: true });

  const result = await generateInsights({
    summary: ai.summary_md,
    takeaways: ai.takeaways_md ?? "",
    profileMd,
    primaryContext: ai.primary_context ?? null,
    userId: user.id,
    itemId,
  }).catch(async (err) => {
    await captureError("ai.insights", err, { itemId, regenerate: true }, user.id);
    return null;
  });

  if (!result) {
    return { ok: false, skipped: "generation_failed" };
  }

  const { data: latest } = await supabase
    .from("insight_cards")
    .select("version")
    .eq("item_id", itemId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest?.version ?? 0) + 1;

  if (result.cards.length > 0) {
    const rows = result.cards.map((c) => ({
      item_id: itemId,
      version: nextVersion,
      context: c.context,
      headline: c.headline,
      body_md: c.body_md,
      suggested_actions_md: c.suggested_actions_md ?? null,
      confidence: c.confidence,
    }));
    await supabase.from("insight_cards").insert(rows);
  }

  await logEvent("ai.insights.completed", user.id, {
    itemId,
    version: nextVersion,
    cardCount: result.cards.length,
    regenerate: true,
  });
  log.info("insights.regenerated", { itemId, version: nextVersion, count: result.cards.length });

  revalidatePath(`/item/${itemId}`);
  return { ok: true, cardCount: result.cards.length };
}

export async function markRead(itemId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({ read_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .is("read_at", null);
  if (!error) await logEvent("item.read", user.id, { itemId });
  revalidatePath("/feed");
  revalidatePath(`/item/${itemId}`);
}

export async function markUnread(itemId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("items").update({ read_at: null }).eq("id", itemId).eq("user_id", user.id);
  await logEvent("item.unread", user.id, { itemId });
  revalidatePath("/feed");
  revalidatePath(`/item/${itemId}`);
}

export async function starItem(itemId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("items")
    .update({ starred_at: new Date().toISOString() })
    .eq("id", itemId)
    .eq("user_id", user.id);
  await logEvent("item.starred", user.id, { itemId });
  revalidatePath("/feed");
  revalidatePath(`/item/${itemId}`);
}

export async function unstarItem(itemId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("items").update({ starred_at: null }).eq("id", itemId).eq("user_id", user.id);
  await logEvent("item.unstarred", user.id, { itemId });
  revalidatePath("/feed");
  revalidatePath(`/item/${itemId}`);
}
