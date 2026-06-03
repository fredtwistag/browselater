import type { Context } from "@/lib/db/types";

export type SidebarContextKey = "personal" | "family" | "wealth" | "health" | "twistag";

export const SIDEBAR_CONTEXTS: {
  key: SidebarContextKey;
  label: string;
  tint: string;
  match: (c: Context) => boolean;
}[] = [
  {
    key: "personal",
    label: "Personal",
    tint: "var(--context-personal)",
    match: (c) => c === "personal",
  },
  { key: "family", label: "Family", tint: "var(--context-family)", match: (c) => c === "family" },
  { key: "wealth", label: "Wealth", tint: "var(--context-wealth)", match: (c) => c === "wealth" },
  { key: "health", label: "Health", tint: "var(--context-health)", match: (c) => c === "health" },
  {
    key: "twistag",
    label: "Twistag",
    tint: "var(--context-twistag)",
    match: (c) => c.startsWith("twistag."),
  },
];

export function contextTintVar(context: Context | null): string | null {
  if (!context) return null;
  if (context.startsWith("twistag.")) return "var(--context-twistag)";
  if (["personal", "family", "wealth", "health"].includes(context)) {
    return `var(--context-${context})`;
  }
  return null;
}

export function contextLabel(context: Context | null): string | null {
  if (!context) return null;
  if (context === "twistag.ops") return "Twistag · Ops";
  if (context === "twistag.sales") return "Twistag · Sales";
  if (context === "twistag.devex") return "Twistag · DevEx";
  if (context === "twistag.innovation") return "Twistag · Innovation";
  if (context === "twistag.marketing") return "Twistag · Marketing";
  return context.charAt(0).toUpperCase() + context.slice(1);
}
