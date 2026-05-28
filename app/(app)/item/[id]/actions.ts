"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireUser } from "@/lib/supabase/server";
import { enqueueExtract } from "@/workers/queue";
import { logEvent } from "@/lib/events";
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
