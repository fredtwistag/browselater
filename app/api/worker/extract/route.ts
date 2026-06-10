import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runExtractPipeline } from "@/workers/jobs/extract";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({ itemId: z.string().uuid(), userId: z.string().uuid() });

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-worker-secret");
  const expected = process.env.WORKER_SECRET;
  // Fail-closed: an unset WORKER_SECRET 401s every request (the !expected arm).
  if (!secret || !expected || !safeEqual(secret, expected)) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return new NextResponse("bad body", { status: 400 });

  // Run async; don't block the queue dispatcher. Vercel keeps the fn alive
  // because we await before returning here, but downstream calls can keep streaming.
  try {
    await runExtractPipeline(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
