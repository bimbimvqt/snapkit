import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { r2ConfigurationStatus } from "@/lib/r2-storage";

export async function GET() {
  let database = "down";
  try {
    await db.$queryRaw`SELECT 1`;
    database = "up";
  } catch {}
  const objectStorage = r2ConfigurationStatus();
  const healthy = database === "up" && (!objectStorage.required || objectStorage.configured);
  return ok(
    {
      service: "snapkit",
      status: healthy ? "healthy" : "degraded",
      database,
      objectStorage: objectStorage.configured ? "r2" : "local",
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
