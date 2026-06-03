import type { ListItem } from "./list-row";

export function DateDivider({ label }: { label: string }) {
  return (
    <div className="sticky top-0 z-[1] flex items-center gap-2 bg-background/95 px-3 pb-1 pt-3 backdrop-blur">
      <span className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <span className="h-px flex-1 bg-border/60" />
    </div>
  );
}

export function groupByDate(items: ListItem[]): { label: string; items: ListItem[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const groups: Record<string, ListItem[]> = {
    Today: [],
    Yesterday: [],
    "This week": [],
    "Earlier this month": [],
    Older: [],
  };

  for (const it of items) {
    const t = new Date(it.created_at).getTime();
    if (t >= startOfToday) groups["Today"].push(it);
    else if (t >= startOfYesterday) groups["Yesterday"].push(it);
    else if (t >= startOfWeek) groups["This week"].push(it);
    else if (t >= startOfMonth) groups["Earlier this month"].push(it);
    else groups["Older"].push(it);
  }

  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => ({ label, items: list }));
}
