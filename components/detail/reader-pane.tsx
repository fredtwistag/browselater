import { ItemHeader } from "./item-header";
import { SummarySection } from "./summary";
import { TakeawaysSection } from "./takeaways";
import { InsightsSection } from "./insights";
import { OriginalMedia } from "./original-media";
import { ItemNotes } from "./item-notes";
import { LiveRefresh } from "./live-refresh";
import { FailedNote } from "./failed-note";
import { ThinSourceBanner } from "./thin-source-banner";
import { ReaderToolbar } from "./reader-toolbar";
import { ReaderMeta } from "./reader-meta";
import { ScrollProgress } from "./scroll-progress";
import { AutoMarkRead } from "./auto-mark-read";
import type { ItemBundle } from "@/lib/detail/load-item";

interface ReaderPaneProps {
  bundle: ItemBundle;
  backHref?: string;
  backMobileOnly?: boolean;
  /** When false, do not auto-mark-read (e.g. on the standalone /item/[id] route). */
  autoMarkRead?: boolean;
}

export function ReaderPane({
  bundle,
  backHref,
  backMobileOnly,
  autoMarkRead = true,
}: ReaderPaneProps) {
  const { item, latestAi, insights, tags, content } = bundle;
  const isPending = item.status === "pending" || item.status === "extracting";

  return (
    <section
      key={item.id}
      className="pane-enter flex h-full min-w-0 flex-col bg-background"
      aria-label="Reader"
    >
      <ReaderToolbar
        itemId={item.id}
        isArchived={!!item.archived_at}
        isStarred={!!item.starred_at}
        isRead={!!item.read_at}
        canonicalUrl={item.canonical_url}
        backHref={backHref}
        backMobileOnly={backMobileOnly}
      />
      <ScrollProgress />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isPending && <LiveRefresh itemId={item.id} />}
        {autoMarkRead && !isPending && (
          <AutoMarkRead itemId={item.id} alreadyRead={!!item.read_at} />
        )}

        <div className="mx-auto max-w-3xl px-6 py-8 md:px-10 md:py-10">
          <div className="mb-4">
            <ReaderMeta
              sourceDomain={item.source_domain}
              canonicalUrl={item.canonical_url}
              readTimeMinutes={item.read_time_minutes}
              primaryContext={latestAi?.primary_context ?? null}
              insightCount={insights.length}
              isPaywalled={item.is_paywalled}
              thinSource={
                latestAi?.source_quality === "thin" || latestAi?.source_quality === "title_only"
                  ? latestAi.source_quality
                  : null
              }
            />
          </div>

          <article className="min-w-0 space-y-10">
            <ItemHeader
              item={item}
              tags={tags}
              primaryContext={latestAi?.primary_context ?? null}
            />

            {latestAi?.source_quality === "title_only" && (
              <ThinSourceBanner message="Only the headline / link preview was available — no full article content was extracted." />
            )}
            {latestAi?.source_quality === "thin" && (
              <ThinSourceBanner
                message="Source had limited content — summary is proportionally short. No fabricated detail."
                tone="info"
              />
            )}
            {latestAi?.summary_md ? (
              <SummarySection summaryMd={latestAi.summary_md} />
            ) : isPending ? (
              <PendingNote message="Summary will appear here." />
            ) : item.status === "failed" ? (
              <FailedNote itemId={item.id} reason={item.error_message ?? "extraction failed"} />
            ) : null}

            {latestAi?.takeaways_md && <TakeawaysSection takeawaysMd={latestAi.takeaways_md} />}

            <InsightsSection itemId={item.id} cards={insights} pending={isPending} />

            <OriginalMedia item={item} content={content} />

            <ItemNotes itemId={item.id} initialNotes={item.user_notes ?? ""} />
          </article>
        </div>
      </div>
    </section>
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
