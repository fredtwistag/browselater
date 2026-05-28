import { requireUser } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsNav } from "@/components/settings/settings-nav";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  await requireUser();
  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What leaves your machine, and what stays.
        </p>
      </div>

      <SettingsNav active="privacy" />

      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-medium">What we send externally</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>
                <strong>Anthropic (Claude):</strong> the extracted text of every save, plus your
                personalization profile, gets sent to Anthropic to produce the summary, key
                takeaways, tags, and personalized insights. The profile is sent on every save and
                every re-run.
              </li>
              <li>
                <strong>YouTube:</strong> when you save a YouTube URL, we fetch the public video
                page through Playwright to scrape the transcript. No authentication; same data
                anyone browsing that page would see.
              </li>
              <li>
                <strong>Voyage AI</strong> (if you set <code>VOYAGE_API_KEY</code>): chunks of your
                extracted content are sent to Voyage to produce embeddings used for semantic search
                and chat retrieval.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-medium">What we don&apos;t send</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>No 3rd-party analytics SDKs. App events go to your own Postgres table.</li>
              <li>No social pixels, no advertising trackers.</li>
              <li>Your personalization profile is never logged in app analytics.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-medium">Where data lives</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Postgres rows + pgvector embeddings: Supabase, encrypted at rest.</li>
              <li>HTML snapshots, PDFs, image originals: Supabase Storage (private buckets).</li>
              <li>Backups: Supabase daily, retained per your plan.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
