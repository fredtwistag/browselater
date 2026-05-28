import { requireUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatRelativeTime } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SettingsNav } from "@/components/settings/settings-nav";

export const dynamic = "force-dynamic";

interface ErrorRow {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
}

export default async function ErrorsPage() {
  await requireUser();

  // Service client because RLS filters to caller's user_id, but errors include
  // null-user rows (worker context) that we still want to show on the dashboard.
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("errors")
    .select("id, source, message, stack, context, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  const errors = (data ?? []) as ErrorRow[];

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Errors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent server-side errors. Captured automatically by the worker and AI pipelines.
        </p>
      </div>

      <SettingsNav active="errors" />

      {errors.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No errors recorded. (Healthy, or you haven&apos;t made enough saves yet.)
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {errors.map((e) => (
            <li key={e.id}>
              <Card>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className="font-mono text-xs">
                      {e.source}
                    </Badge>
                    <time
                      dateTime={e.created_at}
                      className="text-xs text-muted-foreground"
                      title={new Date(e.created_at).toLocaleString()}
                    >
                      {formatRelativeTime(e.created_at)}
                    </time>
                  </div>
                  <p className="break-words text-sm">{e.message}</p>
                  {e.context && Object.keys(e.context).length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Context</summary>
                      <pre className="mt-1 overflow-x-auto rounded-md bg-muted/40 p-2 font-mono">
                        {JSON.stringify(e.context, null, 2)}
                      </pre>
                    </details>
                  )}
                  {e.stack && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Stack</summary>
                      <pre className="mt-1 overflow-x-auto rounded-md bg-muted/40 p-2 font-mono">
                        {e.stack}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
