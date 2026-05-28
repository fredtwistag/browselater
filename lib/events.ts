import { createServiceClient } from "@/lib/supabase/service";
import { log } from "@/lib/log";

export type EventName =
  | "save.submitted"
  | "save.duplicate"
  | "extract.started"
  | "extract.succeeded"
  | "extract.failed"
  | "ai.summary.started"
  | "ai.summary.completed"
  | "ai.insights.started"
  | "ai.insights.completed"
  | "ai.rerun"
  | "insight.feedback"
  | "search.query"
  | "chat.query"
  | "profile.updated";

export async function logEvent(
  name: EventName,
  userId: string | null,
  payload?: Record<string, unknown>,
) {
  log.info(name, { userId, ...payload });
  try {
    const supabase = createServiceClient();
    await supabase
      .from("events")
      .insert({ event_name: name, user_id: userId, payload: payload ?? null });
  } catch (err) {
    log.error("logEvent.failed", {
      name,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
