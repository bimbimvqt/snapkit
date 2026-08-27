import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";

const eventSchema = z.object({ deviceId: z.string().min(8).max(80), name: z.enum(["app_open", "qr_created", "qr_scanned", "media_scan", "media_cleanup", "paywall_view"]), platform: z.enum(["ios", "android"]).optional(), metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional() });

export async function POST(request: Request) {
  try {
    const input = eventSchema.parse(await request.json());
    const session = await getSession();
    const event = await db.usageEvent.create({ data: { ...input, userId: session?.userId } });
    return ok({ id: event.id }, { status: 202 });
  } catch (error) { return apiError(error); }
}

