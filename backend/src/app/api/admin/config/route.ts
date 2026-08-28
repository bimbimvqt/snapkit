import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const themeSchema = z.object({
  preset: z.enum(["midnight_lime", "ocean_cyan", "violet_pulse", "sunset_coral", "mint_light", "threads_mono"]),
  mode: z.enum(["dark", "light", "system"]),
  navigationStyle: z.enum(["floating", "glass", "solid"]),
});

export const cleanerSchema = z
  .object({
    maxScanAssets: z.number().int().min(50).max(5000),
    similarImageLimit: z.number().int().min(20).max(2000),
    largeVideoThresholdMb: z.number().int().min(10).max(4096),
    adminSyncEnabled: z.boolean(),
    adminSyncLimit: z.number().int().min(0).max(5000),
  })
  .refine((input) => input.similarImageLimit <= input.maxScanAssets, {
    message: "Số ảnh so trùng không được lớn hơn tổng media mỗi lượt",
    path: ["similarImageLimit"],
  })
  .refine((input) => input.adminSyncLimit <= input.maxScanAssets, {
    message: "Số thumbnail đồng bộ không được lớn hơn tổng media mỗi lượt",
    path: ["adminSyncLimit"],
  });

const updateSchema = z
  .object({ theme: themeSchema.optional(), cleaner: cleanerSchema.optional() })
  .refine((input) => input.theme !== undefined || input.cleaner !== undefined, "Không có cấu hình để cập nhật");

export async function GET() {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");

  const [flags, config] = await Promise.all([
    db.featureFlag.findMany({ orderBy: { key: "asc" } }),
    db.appConfig.findUnique({ where: { key: "mobile" } }),
  ]);

  return ok({ flags, mobileConfig: config?.value ?? {} });
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return fail("Không có quyền truy cập", 403, "FORBIDDEN");

    const input = updateSchema.parse(await request.json());
    const before = await db.appConfig.findUnique({ where: { key: "mobile" } });
    const current = before?.value;
    const currentObject = current && typeof current === "object" && !Array.isArray(current) ? current : {};
    const value = {
      ...currentObject,
      ...(input.theme === undefined ? {} : { theme: input.theme }),
      ...(input.cleaner === undefined ? {} : { cleaner: input.cleaner }),
    };
    const config = await db.appConfig.upsert({
      where: { key: "mobile" },
      update: { value },
      create: { key: "mobile", value },
    });

    await db.auditLog.create({
      data: {
        actorId: admin.userId,
        action: input.cleaner === undefined ? "mobile_config.theme_update" : "mobile_config.cleaner_update",
        entity: "AppConfig",
        entityId: "mobile",
        before: before?.value === null ? Prisma.JsonNull : before?.value,
        after: value,
      },
    });
    return ok({ mobileConfig: config.value, updatedAt: config.updatedAt });
  } catch (error) {
    return apiError(error);
  }
}
