import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { mobileConfigWithDefaults } from "@/lib/mobile-config";

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
    adminMediaUploadEnabled: z.boolean().default(false),
    adminSyncLimit: z.number().int().min(0).max(5000),
    adminImagePreviewMaxPx: z.number().int().min(640).max(4096),
    adminPreviewMaxFileMb: z.number().int().min(1).max(1024),
  })
  .refine((input) => input.similarImageLimit <= input.maxScanAssets, {
    message: "Số ảnh so trùng không được lớn hơn tổng media mỗi lượt",
    path: ["similarImageLimit"],
  })
  .refine((input) => !input.adminMediaUploadEnabled || input.adminSyncLimit <= input.maxScanAssets, {
    message: "Số thumbnail đồng bộ không được lớn hơn tổng media mỗi lượt",
    path: ["adminSyncLimit"],
  })
  .refine((input) => !input.adminMediaUploadEnabled || input.adminSyncEnabled, {
    message: "Phải bật đồng bộ thống kê trước khi cho phép tải media",
    path: ["adminMediaUploadEnabled"],
  });

const adUnitIdSchema = z.union([
  z.literal(""),
  z.string().trim().regex(/^ca-app-pub-\d{16}\/\d{10}$/, "Ad unit ID không đúng định dạng AdMob"),
]);

export const adsSchema = z
  .object({
    mode: z.enum(["off", "test", "live"]),
    bannerEnabled: z.boolean(),
    interstitialEnabled: z.boolean(),
    interstitialEvery: z.number().int().min(1).max(20),
    minimumInterstitialIntervalSeconds: z.number().int().min(0).max(3600),
    nonPersonalizedAds: z.boolean(),
    androidBannerAdUnitId: adUnitIdSchema,
    iosBannerAdUnitId: adUnitIdSchema,
    androidInterstitialAdUnitId: adUnitIdSchema,
    iosInterstitialAdUnitId: adUnitIdSchema,
  })
  .superRefine((input, context) => {
    if (input.mode !== "live") return;
    if (input.bannerEnabled) {
      if (!input.androidBannerAdUnitId) {
        context.addIssue({ code: "custom", message: "Thiếu Android banner ad unit ID", path: ["androidBannerAdUnitId"] });
      }
      if (!input.iosBannerAdUnitId) {
        context.addIssue({ code: "custom", message: "Thiếu iOS banner ad unit ID", path: ["iosBannerAdUnitId"] });
      }
    }
    if (input.interstitialEnabled) {
      if (!input.androidInterstitialAdUnitId) {
        context.addIssue({ code: "custom", message: "Thiếu Android interstitial ad unit ID", path: ["androidInterstitialAdUnitId"] });
      }
      if (!input.iosInterstitialAdUnitId) {
        context.addIssue({ code: "custom", message: "Thiếu iOS interstitial ad unit ID", path: ["iosInterstitialAdUnitId"] });
      }
    }
  });

const updateSchema = z
  .object({ theme: themeSchema.optional(), cleaner: cleanerSchema.optional(), ads: adsSchema.optional() })
  .refine(
    (input) => input.theme !== undefined || input.cleaner !== undefined || input.ads !== undefined,
    "Không có cấu hình để cập nhật",
  );

export async function GET() {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");

  const [flags, config] = await Promise.all([
    db.featureFlag.findMany({ orderBy: { key: "asc" } }),
    db.appConfig.findUnique({ where: { key: "mobile" } }),
  ]);

  return ok({ flags, mobileConfig: mobileConfigWithDefaults(config?.value) });
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
      ...(input.ads === undefined ? {} : { ads: input.ads }),
    };
    const config = await db.appConfig.upsert({
      where: { key: "mobile" },
      update: { value },
      create: { key: "mobile", value },
    });

    await db.auditLog.create({
      data: {
        actorId: admin.userId,
        action: input.ads !== undefined
          ? "mobile_config.ads_update"
          : input.cleaner !== undefined
            ? "mobile_config.cleaner_update"
            : "mobile_config.theme_update",
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
