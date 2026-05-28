import { notFound } from "next/navigation";
import { requireUser, createClient } from "@/lib/supabase/server";
import { ItemHeader } from "@/components/detail/item-header";
import { AtAGlance } from "@/components/detail/at-a-glance";
import { SummarySection } from "@/components/detail/summary";
import { TakeawaysSection } from "@/components/detail/takeaways";
import { InsightsSection } from "@/components/detail/insights";
import { OriginalMedia } from "@/components/detail/original-media";
import { ItemNotes } from "@/components/detail/item-notes";
import { ItemActions } from "@/components/detail/item-actions";
import { LiveRefresh } from "@/components/detail/live-refresh";
import { FailedNote } from "@/components/detail/failed-note";

export const dynamic = "force-dynamic";

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("items")
    .select(
      "id, title, author, published_at, hero_image_url, hero_image_alt, canonical_url, original_url, type, status, error_message, is_paywalled, source_domain, read_time_minutes, created_at, archived_at, user_notes",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!item) notFound();

  const { data: aiVersions } = await supabase
    .from("item_ai")
    .select("id, version, at_a_glance_md, summary_md, takeaways_md, primary_context, created_at")
    .eq("item_id", id)
    .order("version", { ascending: false })
    .limit(1);
  const latestAi = aiVersions?.[0] ?? null;

  const { data: insights } = await supabase
    .from("insight_cards")
    .select(
      "id, context, headline, body_md, suggested_actions_md, confidence, user_feedback, version",
    )
    .eq("item_id", id)
    .eq("version", latestAi?.version ?? 0)
    .order("confidence", { ascending: false });

  const { data: tags } = await supabase
    .from("item_tags")
    .select("source, tag:tags(name)")
    .eq("item_id", id);

  const { data: content } = await supabase
    .from("item_content")
    .select("raw_text, transcript_json, pdf_storage_key, image_storage_key, html_snapshot_key")
    .eq("item_id", id)
    .maybeSingle();

  const tagNames = (tags ?? [])
    .map((t) => (Array.isArray(t.tag) ? t.tag[0]?.name : (t.tag as { name?: string } | null)?.name))
    .filter((n): n is string => !!n);

  const isPending = item.status === "pending" || item.status === "extracting";

  return (
    <div className="container max-w-7xl py-8">
      {isPending && <LiveRefresh itemId={item.id} />}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr,320px]">
        <article className="min-w-0 space-y-12">
          <ItemHeader
            item={item}
            tags={tagNames}
            primaryContext={latestAi?.primary_context ?? null}
          />

          {latestAi?.summary_md ? (
            <SummarySection summaryMd={latestAi.summary_md} />
          ) : isPending ? (
            <PendingNote message="Summary will appear here." />
          ) : item.status === "failed" ? (
            <FailedNote itemId={item.id} reason={item.error_message ?? "extraction failed"} />
          ) : null}

          {latestAi?.takeaways_md && <TakeawaysSection takeawaysMd={latestAi.takeaways_md} />}

          <InsightsSection itemId={item.id} cards={insights ?? []} pending={isPending} />

          <OriginalMedia item={item} content={content ?? null} />

          <ItemNotes itemId={item.id} initialNotes={item.user_notes ?? ""} />
        </article>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {latestAi && (
            <AtAGlance
              atAGlanceMd={latestAi.at_a_glance_md ?? ""}
              tags={tagNames}
              type={item.type}
              primaryContext={latestAi.primary_context}
            />
          )}
          <ItemActions
            itemId={item.id}
            isArchived={!!item.archived_at}
            canonicalUrl={item.canonical_url}
          />
        </aside>
      </div>
    </div>
  );
}

function PendingNote({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed bg-card/30 p-6 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        Working on it… {message}
      </div>
    </div>
  );
}
