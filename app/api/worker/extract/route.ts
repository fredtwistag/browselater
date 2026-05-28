import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { runExtractPipeline } from "@/workers/jobs/extract";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({ itemId: z.string().uuid(), userId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-worker-secret");
  if (!secret || secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
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
