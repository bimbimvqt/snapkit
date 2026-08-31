import { Prisma } from "@prisma/client";
import { apiError, fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { defaultSubscriptionConfig, parseSubscriptionConfig, subscriptionConfigSchema } from "@/lib/subscription-plans";

const configKey = "subscription_plans";

export async function GET() {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");
  const config = await db.appConfig.findUnique({ where: { key: configKey } });
  return ok({ config: config ? parseSubscriptionConfig(config.value) : defaultSubscriptionConfig, updatedAt: config?.updatedAt ?? null });
}

export async function PUT(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return fail("Không có quyền truy cập", 403, "FORBIDDEN");

    const value = subscriptionConfigSchema.parse(await request.json());
    const before = await db.appConfig.findUnique({ where: { key: configKey } });
    const config = await db.$transaction(async (transaction) => {
      const saved = await transaction.appConfig.upsert({
        where: { key: configKey },
        update: { value },
        create: { key: configKey, value },
      });
      await transaction.auditLog.create({
        data: {
          actorId: admin.userId,
          action: "subscription_plans.update",
          entity: "AppConfig",
          entityId: configKey,
          before: before?.value === null || before?.value === undefined ? Prisma.JsonNull : before.value,
          after: value,
        },
      });
      return saved;
    });
    return ok({ config: parseSubscriptionConfig(config.value), updatedAt: config.updatedAt });
  } catch (error) {
    return apiError(error);
  }
}
