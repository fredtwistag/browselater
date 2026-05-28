import { anthropic } from "@ai-sdk/anthropic";

export const haiku = () =>
  anthropic(process.env.ANTHROPIC_MODEL_HAIKU ?? "claude-haiku-4-5-20251001");
export const sonnet = () => anthropic(process.env.ANTHROPIC_MODEL_SONNET ?? "claude-sonnet-4-6");
