"use server";

import { createClient, requireUser } from "@/lib/supabase/server";

export type PaletteItem = {
  id: string;
  title: string | null;
  canonical_url: string;
  source_domain: string | null;
};

export async function getRecentItems(): Promise<PaletteItem[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("items")
    .select("id, title, canonical_url, source_domain")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(8);
  return data ?? [];
}
