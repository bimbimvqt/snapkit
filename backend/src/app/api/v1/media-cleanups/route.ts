import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";

const schema = z.object({ deviceId: z.string().min(8).max(80), scannedCount: z.number().int().nonnegative(), removedCount: z.number().int().nonnegative(), bytesFreed: z.number().int().nonnegative(), durationMs: z.number().int().nonnegative().optional() });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const session = await getSession();
    const cleanup = await db.mediaCleanup.create({ data: { ...input, bytesFreed: BigInt(input.bytesFreed), userId: session?.userId } });
    return ok({ id: cleanup.id }, { status: 201 });
  } catch (error) { return apiError(error); }
}

