import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");
  return ok(await db.featureFlag.findMany({ orderBy: { key: "asc" } }));
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return fail("Không có quyền truy cập", 403, "FORBIDDEN");
    const input = z.object({ key: z.string().min(2).max(64), enabled: z.boolean(), rollout: z.number().int().min(0).max(100) }).parse(await request.json());
    const before = await db.featureFlag.findUnique({ where: { key: input.key } });
    const flag = await db.featureFlag.update({ where: { key: input.key }, data: { enabled: input.enabled, rollout: input.rollout } });
    await db.auditLog.create({ data: { actorId: admin.userId, action: "feature_flag.update", entity: "FeatureFlag", entityId: flag.key, before: before ?? undefined, after: flag } });
    return ok(flag);
  } catch (error) { return apiError(error); }
}

