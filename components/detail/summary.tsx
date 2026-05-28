import { Markdown } from "./markdown";

export function SummarySection({ summaryMd }: { summaryMd: string }) {
  return (
    <section aria-labelledby="summary-heading" className="space-y-4">
      <h2 id="summary-heading" className="font-serif text-2xl font-semibold tracking-tight">
        Summary
      </h2>
      <div className="reading-column">
        <Markdown>{summaryMd}</Markdown>
      </div>
    </section>
  );
}
