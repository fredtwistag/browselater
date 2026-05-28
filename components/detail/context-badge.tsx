import type { Context } from "@/lib/db/types";
import { cn } from "@/lib/utils";

const CONTEXT_LABELS: Record<Context, string> = {
  personal: "Personal",
  family: "Family",
  wealth: "Wealth",
  health: "Health",
  "twistag.ops": "Twistag · Ops",
  "twistag.sales": "Twistag · Sales",
  "twistag.devex": "Twistag · DevEx",
  "twistag.innovation": "Twistag · Innovation",
  "twistag.marketing": "Twistag · Marketing",
};

function rootContext(c: Context): "personal" | "family" | "wealth" | "health" | "twistag" {
  if (c.startsWith("twistag")) return "twistag";
  return c as "personal" | "family" | "wealth" | "health";
}

export function ContextBadge({ context, className }: { context: Context; className?: string }) {
  const root = rootContext(context);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        root === "personal" && "bg-context-personal text-foreground",
        root === "family" && "bg-context-family text-foreground",
        root === "wealth" && "bg-context-wealth text-foreground",
        root === "health" && "bg-context-health text-foreground",
        root === "twistag" && "bg-context-twistag text-foreground",
        className,
      )}
    >
      {CONTEXT_LABELS[context]}
    </span>
  );
}

export { CONTEXT_LABELS };
