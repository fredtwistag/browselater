"use client";

import { useState, useTransition } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "./markdown";
import { ContextBadge } from "./context-badge";
import { recordInsightFeedback } from "@/app/(app)/item/[id]/actions";
import { cn } from "@/lib/utils";
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
      <section aria-labelledby="insights-heading" className="space-y-4">
        <h2 id="insights-heading" className="font-serif text-2xl font-semibold tracking-tight">
          Personalized insights
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </section>
    );
  }

  if (cards.length === 0) {
    return (
      <section aria-labelledby="insights-heading" className="space-y-4">
        <h2 id="insights-heading" className="font-serif text-2xl font-semibold tracking-tight">
          Personalized insights
        </h2>
        <p className="text-sm text-muted-foreground">
          No insights for this one — the source didn&apos;t map cleanly to your contexts.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="insights-heading" className="space-y-4">
      <h2 id="insights-heading" className="font-serif text-2xl font-semibold tracking-tight">
        Personalized insights
      </h2>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <li key={c.id}>
            <InsightCard itemId={itemId} card={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function InsightCard({ itemId, card }: { itemId: string; card: InsightCardRow }) {
  const [feedback, setFeedback] = useState<Feedback>(card.user_feedback);
  const [pending, startTransition] = useTransition();

  function vote(value: "up" | "down") {
    const next = feedback === value ? null : value;
    setFeedback(next);
    startTransition(async () => {
      await recordInsightFeedback({ itemId, cardId: card.id, feedback: next });
    });
  }

  return (
    <Card className="h-full">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <ContextBadge context={card.context} />
          <Badge
            variant="outline"
            className={cn(
              card.confidence === "high" &&
                "border-green-500/40 text-green-700 dark:text-green-300",
              card.confidence === "medium" &&
                "border-amber-500/40 text-amber-700 dark:text-amber-300",
              card.confidence === "low" && "border-muted-foreground/40 text-muted-foreground",
            )}
          >
            {card.confidence} confidence
          </Badge>
        </div>

        <h3 className="font-serif text-lg font-semibold leading-snug">{card.headline}</h3>

        <div className="text-sm">
          <Markdown>{card.body_md}</Markdown>
        </div>

        {card.suggested_actions_md && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Suggested actions
            </div>
            <Markdown>{card.suggested_actions_md}</Markdown>
          </div>
        )}

        <div className="flex items-center gap-1 border-t pt-3">
          <Button
            size="sm"
            variant={feedback === "up" ? "default" : "ghost"}
            onClick={() => vote("up")}
            disabled={pending}
            aria-label="Helpful"
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={feedback === "down" ? "default" : "ghost"}
            onClick={() => vote("down")}
            disabled={pending}
            aria-label="Not helpful"
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
