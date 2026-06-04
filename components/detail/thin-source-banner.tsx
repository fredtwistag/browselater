import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  message: string;
  tone?: "warning" | "info";
}

export function ThinSourceBanner({ message, tone = "warning" }: Props) {
  const Icon = tone === "warning" ? AlertCircle : Info;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border p-4 text-sm",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-50/40 text-amber-900 dark:bg-amber-900/10 dark:text-amber-200"
          : "border-blue-500/30 bg-blue-50/40 text-blue-900 dark:bg-blue-900/10 dark:text-blue-200",
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
