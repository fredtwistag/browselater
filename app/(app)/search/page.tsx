import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { searchLibrary } from "@/lib/search";
import { logEvent } from "@/lib/events";
import { Input } from "@/components/ui/input";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const hits = query.length >= 2 ? await searchLibrary(user.id, query) : [];
  if (query) await logEvent("search.query", user.id, { len: query.length, hits: hits.length });

  return (
    <div className="container max-w-3xl py-8">
      <form className="mb-6">
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search your library"
          autoFocus
        />
      </form>
      {query.length < 2 ? (
        <p className="text-sm text-muted-foreground">Type at least 2 characters.</p>
      ) : hits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matches.</p>
      ) : (
        <ul className="space-y-3">
          {hits.map((h) => (
            <li key={h.itemId} className="rounded-lg border bg-card p-4">
              <Link href={`/item/${h.itemId}`} className="text-base font-medium hover:underline">
                {h.title}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">{h.snippet}</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {h.kind} · score {h.score.toFixed(2)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
