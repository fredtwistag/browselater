import { createServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/log";

/**
 * Sentry-free error reporting. Capture once, store in `errors`, view in /settings/errors.
 *
 * Use `captureError(source, err, context?)` from API routes, Server Actions,
 * and worker jobs. Never log raw user content into context.
 */
export async function captureError(
  source: string,
  err: unknown,
  context?: Record<string, unknown>,
  userId?: string | null,
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? (err.stack ?? null) : null;
  log.error(`err.${source}`, { message, ...context });

  try {
    const supabase = createServiceClient();
    await supabase.from("errors").insert({
      source,
      message: message.slice(0, 1000),
      stack: stack?.slice(0, 4000) ?? null,
      context: context ?? null,
      user_id: userId ?? null,
    });
  } catch (innerErr) {
    log.error("err.capture_failed", {
      message: innerErr instanceof Error ? innerErr.message : String(innerErr),
    });
  }
}
