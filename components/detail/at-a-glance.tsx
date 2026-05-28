import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContextBadge } from "./context-badge";
import type { ContentType, Context } from "@/lib/db/types";

interface AtAGlanceProps {
  atAGlanceMd: string;
  tags: string[];
  type: ContentType;
  primaryContext: Context | null;
}

export function AtAGlance({ atAGlanceMd, tags, type, primaryContext }: AtAGlanceProps) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{typeLabel(type)}</Badge>
          {primaryContext && <ContextBadge context={primaryContext} />}
        </div>
        <p className="text-sm leading-relaxed">{atAGlanceMd}</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t pt-3">
            {tags.slice(0, 6).map((t) => (
              <span key={t} className="text-xs text-muted-foreground">
                #{t}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function typeLabel(t: ContentType): string {
  switch (t) {
    case "article":
      return "Article";
    case "youtube":
      return "YouTube";
    case "pdf":
      return "PDF";
    case "image":
      return "Image";
    default:
      return "Link";
  }
}
