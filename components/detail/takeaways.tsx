import { Markdown } from "./markdown";

export function TakeawaysSection({ takeawaysMd }: { takeawaysMd: string }) {
  return (
    <section aria-labelledby="takeaways-heading" className="space-y-4">
      <h2 id="takeaways-heading" className="font-serif text-2xl font-semibold tracking-tight">
        Key takeaways
      </h2>
      <div className="reading-column">
        <Markdown>{takeawaysMd}</Markdown>
      </div>
    </section>
  );
}
