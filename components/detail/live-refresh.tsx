"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * While an item is pending/extracting, subscribe to Realtime updates on the items row.
 * When the status flips to ready/failed, refresh the page so server-rendered children
 * (summary, insights) re-fetch.
 *
 * Falls back to a 5s poll if Realtime isn't enabled on the project.
 */
export function LiveRefresh({ itemId }: { itemId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`item:${itemId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "items", filter: `id=eq.${itemId}` },
        (payload) => {
          const next = (payload.new as { status?: string } | null)?.status;
          if (next === "ready" || next === "failed") {
            router.refresh();
          } else if (next === "extracting") {
            router.refresh();
          }
        },
      )
      .subscribe();

    const poll = setInterval(() => router.refresh(), 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [itemId, router]);

  return null;
}
