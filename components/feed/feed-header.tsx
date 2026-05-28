import { SaveInput } from "./save-input";

export function FeedHeader() {
  return (
    <div className="mb-8 space-y-3">
      <h1 className="text-3xl font-semibold tracking-tight">Feed</h1>
      <p className="text-muted-foreground">Paste a URL to save it. We&apos;ll handle the rest.</p>
      <SaveInput />
    </div>
  );
}
