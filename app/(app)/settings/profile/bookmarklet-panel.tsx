import { Card, CardContent } from "@/components/ui/card";
import { signBookmarkletToken, bookmarkletSnippet } from "@/lib/bookmarklet";
import { siteUrl } from "@/lib/env";
import { CopyButton } from "./copy-button";

export function BookmarkletPanel({ userId }: { userId: string }) {
  let token: string | null = null;
  try {
    token = signBookmarkletToken(userId);
  } catch {
    // BOOKMARKLET_SIGNING_SECRET not set — show a note instead.
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div>
          <h2 className="text-lg font-medium">Bookmarklet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag this to your bookmarks bar. Click it on any page to save the current URL.
          </p>
        </div>

        {token ? (
          <>
            <div className="rounded-md border bg-muted/30 p-3">
              <a
                href={bookmarkletSnippet(siteUrl(), token)}
                onClick={(e) => e.preventDefault()}
                className="font-medium text-primary"
              >
                Save to BrowseLater
              </a>
            </div>
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">Show the snippet</summary>
              <div className="mt-2 space-y-2">
                <code className="block break-all rounded-md border bg-card p-3 font-mono text-xs">
                  {bookmarkletSnippet(siteUrl(), token)}
                </code>
                <CopyButton text={bookmarkletSnippet(siteUrl(), token)} />
              </div>
            </details>
          </>
        ) : (
          <p className="rounded-md border border-amber-500/40 bg-amber-50/30 p-3 text-sm">
            <code>BOOKMARKLET_SIGNING_SECRET</code> is not configured. Set it in env to enable the
            bookmarklet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
