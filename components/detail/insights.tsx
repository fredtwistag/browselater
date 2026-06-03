"use client";

import { useState, useTransition } from "react";
import { ChevronRight, ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "./markdown";
import { recordInsightFeedback } from "@/app/(app)/item/[id]/actions";
import { cn } from "@/lib/utils";
import { contextLabel, contextTintVar } from "@/lib/shell/contexts";
import type { Context, Confidence, Feedback } from "@/lib/db/types";

interface InsightCardRow {
  id: string;
  context: Context;
  headline: string;
  body_md: string;
  suggested_actions_md: string | null;
  confidence: Confidence;
  user_feedback: Feedback;
  version: number;
}

export function InsightsSection({
  itemId,
  cards,
  pending,
}: {
  itemId: string;
  cards: InsightCardRow[];
  pending: boolean;
}) {
  if (pending && cards.length === 0) {
    return (
      <Section>
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </Section>
    );
  }

  if (cards.length === 0) {
    return (
      <Section>
        <p className="text-sm text-muted-foreground">
          No insights for this one — the source didn&apos;t map cleanly to your contexts.
        </p>
      </Section>
    );
  }

  return (
    <Section>
      <ul className="space-y-2.5">
        {cards.map((c) => (
          <li key={c.id}>
            <InsightCard itemId={itemId} card={c} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="insights-heading" className="space-y-4">
      <h2 id="insights-heading" className="font-serif text-2xl font-semibold tracking-tight">
        Personalized insights
      </h2>
      {children}
    </section>
  );
}

function InsightCard({ itemId, card }: { itemId: string; card: InsightCardRow }) {
  const [feedback, setFeedback] = useState<Feedback>(card.user_feedback);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const tint = contextTintVar(card.context);
  const label = contextLabel(card.context);

  function vote(value: "up" | "down") {
    const next = feedback === value ? null : value;
    setFeedback(next);
    startTransition(async () => {
      await recordInsightFeedback({ itemId, cardId: card.id, feedback: next });
    });
  }

  return (
    <article
      className="rounded-md border border-l-[3px] bg-card p-4"
      style={tint ? { borderLeftColor: `hsl(${tint})` } : undefined}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          {tint && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: `hsl(${tint})` }}
              aria-hidden
            />
          )}
          <span className="font-medium text-muted-foreground">{label}</span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "border-transparent px-1.5 py-0 text-[10px] uppercase tracking-wider",
            card.confidence === "high" && "text-green-700 dark:text-green-300",
            card.confidence === "medium" && "text-amber-700 dark:text-amber-300",
            card.confidence === "low" && "text-muted-foreground",
          )}
        >
          {card.confidence}
        </Badge>
      </header>

      <h3 className="mt-2 text-[15px] font-semibold leading-snug">{card.headline}</h3>

      <div className="prose-sm mt-2 text-sm text-foreground/90">
        <Markdown>{card.body_md}</Markdown>
      </div>

      {card.suggested_actions_md && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setActionsOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronRight
              className={cn("h-3 w-3 transition-transform", actionsOpen && "rotate-90")}
            />
            Suggested actions
          </button>
          {actionsOpen && (
            <div className="mt-2 rounded border bg-muted/40 p-3 text-sm">
              <Markdown>{card.suggested_actions_md}</Markdown>
            </div>
          )}
        </div>
      )}

      <div className="-mb-1 mt-3 flex items-center gap-1">
        <Button
          size="sm"
          variant={feedback === "up" ? "default" : "ghost"}
          onClick={() => vote("up")}
          disabled={pending}
          aria-label="Helpful"
          className="h-7 px-2"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant={feedback === "down" ? "default" : "ghost"}
          onClick={() => vote("down")}
          disabled={pending}
          aria-label="Not helpful"
          className="h-7 px-2"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  );
}
