"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { saveProfile } from "@/lib/ai/profile";
import { logEvent } from "@/lib/events";

export async function updateProfileAction(profileMd: string) {
  const user = await requireUser();
  if (profileMd.length > 20_000) {
    throw new Error("Profile too long (20k char max).");
  }
  const version = await saveProfile(user.id, profileMd);
  await logEvent("profile.updated", user.id, { version });
  revalidatePath("/settings/profile");
  return { version };
}
