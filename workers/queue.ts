import { log } from "@/lib/log";

export interface ExtractJob {
  itemId: string;
  userId: string;
}

/**
 * Enqueue an item for extraction.
 *
 * In production: posts to /api/worker/extract on Vercel (which Vercel Queues invokes async).
 * In dev: fires the same route directly via fetch, so the pipeline runs locally without infra.
 *
 * Note: Vercel's Queues product is still rolling out. Until it's wired in this project,
 * we use a "fire and forget HTTP request to our own worker route" pattern. The route is
 * protected by a shared secret header so only the app itself can invoke it.
 */
export async function enqueueExtract(job: ExtractJob): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/worker/extract`;
  log.debug("queue.enqueue", { itemId: job.itemId });
  try {
    void fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-worker-secret": process.env.WORKER_SECRET ?? "",
      },
      body: JSON.stringify(job),
    }).catch((err) => log.error("queue.enqueue_failed", { err: String(err) }));
  } catch (err) {
    log.error("queue.enqueue_throw", { err: String(err) });
  }
}
