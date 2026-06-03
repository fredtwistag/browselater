import { ExternalLink, Lock } from "lucide-react";
import { contextLabel, contextTintVar } from "@/lib/shell/contexts";
import type { Context } from "@/lib/db/types";

interface ReaderMetaProps {
  sourceDomain: string | null;
  canonicalUrl: string;
  readTimeMinutes: number | null;
  primaryContext: Context | null;
  insightCount: number;
  isPaywalled: boolean;
  thinSource?: "thin" | "title_only" | null;
}

export function ReaderMeta({
  sourceDomain,
  canonicalUrl,
  readTimeMinutes,
  primaryContext,
  insightCount,
  isPaywalled,
  thinSource,
}: ReaderMetaProps) {
  const tint = contextTintVar(primaryContext);
  const label = contextLabel(primaryContext);
  let host: string;
  try {
    host = sourceDomain ?? new URL(canonicalUrl).hostname;
  } catch {
    host = canonicalUrl;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {readTimeMinutes ? <span className="tabular-nums">{readTimeMinutes} min</span> : null}
      <a
        href={canonicalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {host}
        <ExternalLink className="h-3 w-3" />
      </a>
      {label && tint && (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: `hsl(${tint})` }}
            aria-hidden
          />
          {label}
        </span>
      )}
      {insightCount > 0 && (
        <span>
          {insightCount} insight{insightCount === 1 ? "" : "s"}
        </span>
      )}
      {isPaywalled && (
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3" /> paywalled
        </span>
      )}
      {thinSource === "title_only" && (
        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
          title only
        </span>
      )}
      {thinSource === "thin" && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">thin source</span>
      )}
    </div>
  );
}
