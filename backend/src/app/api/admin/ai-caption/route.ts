import { apiError, fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  aiCaptionEditableConfigSchema,
  aiCaptionConfigSchema,
  getAICaptionConfig,
  publicAICaptionConfig,
} from "@/lib/caption-ai";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return fail("Không có quyền truy cập", 403, "FORBIDDEN");

  const [config, flag] = await Promise.all([
    getAICaptionConfig(),
    db.featureFlag.findUnique({ where: { key: "ai_caption_studio" } }),
  ]);

  return ok({
    config: publicAICaptionConfig(config),
    flag: flag ?? {
      key: "ai_caption_studio",
      enabled: config.enabled,
      description: "Tạo nội dung mạng xã hội từ ảnh bằng AI",
    },
  });
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return fail("Không có quyền truy cập", 403, "FORBIDDEN");

    const json = await request.json();
    const parsed = aiCaptionEditableConfigSchema.parse(json);

    const currentConfig = await getAICaptionConfig();
    const currentPublicConfig = publicAICaptionConfig(currentConfig);
    const storedConfig = aiCaptionConfigSchema.parse({
      ...currentPublicConfig,
      ...parsed,
    });

    const saved = await db.appConfig.upsert({
      where: { key: "ai_caption" },
      update: { value: storedConfig },
      create: { key: "ai_caption", value: storedConfig },
    });

    if (parsed.enabled !== undefined) {
      await db.featureFlag.upsert({
        where: { key: "ai_caption_studio" },
        update: { enabled: parsed.enabled },
        create: {
          key: "ai_caption_studio",
          enabled: parsed.enabled,
          description: "Tạo nội dung mạng xã hội từ ảnh bằng AI",
        },
      });
    }

    await db.auditLog.create({
      data: {
        actorId: admin.userId,
        action: "ai_caption.config_update",
        entity: "AppConfig",
        entityId: "ai_caption",
        before: currentPublicConfig,
        after: { ...storedConfig, apiKeyConfigured: currentPublicConfig.apiKeyConfigured },
      },
    });

    return ok({
      config: { ...storedConfig, apiKeyConfigured: currentPublicConfig.apiKeyConfigured },
      updatedAt: saved.updatedAt,
    });
  } catch (error) {
    return apiError(error);
  }
}
