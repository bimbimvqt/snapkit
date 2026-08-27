import { db } from "@/lib/db";
import { ok } from "@/lib/api";

export async function GET() {
  let database = "down";
  try {
    await db.$queryRaw`SELECT 1`;
    database = "up";
  } catch {}
  return ok({ service: "toolbox-one", status: database === "up" ? "healthy" : "degraded", database, timestamp: new Date().toISOString() }, { status: database === "up" ? 200 : 503 });
}

