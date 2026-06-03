import { ListRow, type ListItem } from "./list-row";
import { DateDivider, groupByDate } from "./date-divider";
import { EmptyState } from "./empty-state";

interface ListPaneProps {
  items: ListItem[];
  title: string;
  count: number;
  selectedId?: string | null;
  hrefBase?: string;
  emptyFiltered?: boolean;
  emptyFilterLabel?: string;
}

export function ListPane({
  items,
  title,
  count,
  selectedId,
  hrefBase,
  emptyFiltered,
  emptyFilterLabel,
}: ListPaneProps) {
  return (
    <section className="flex h-full min-w-0 flex-col border-r bg-background" aria-label={title}>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
          <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4">
            <EmptyState filtered={emptyFiltered} filterLabel={emptyFilterLabel} />
          </div>
        ) : (
          <ul className="px-1.5 py-1.5">
            {groupByDate(items).map((group) => (
              <li key={group.label}>
                <DateDivider label={group.label} />
                <ul className="space-y-0.5">
                  {group.items.map((it) => (
                    <li key={it.id}>
                      <ListRow item={it} selected={it.id === selectedId} hrefBase={hrefBase} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
