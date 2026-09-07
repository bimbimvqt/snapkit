import { apiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { AICaptionProviderError, captionRequestSchema, generateSocialCaptions, getAICaptionConfig } from "@/lib/caption-ai";
import { db } from "@/lib/db";
import { mediaStorageEntitlement } from "@/lib/media-subscription";

const usageEventName = "ai_caption_generated";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Vui lòng đăng nhập để sử dụng AI Studio", 401, "UNAUTHORIZED");

    const json = await request.json();
    const payload = captionRequestSchema.parse(json);
    const [config, entitlement] = await Promise.all([
      getAICaptionConfig(),
      mediaStorageEntitlement(session.userId),
    ]);
    if (!config.enabled) return fail("AI Studio đang tạm bảo trì", 503, "FEATURE_DISABLED");
    if (!config.openaiApiKey) return fail("AI Studio chưa sẵn sàng", 503, "AI_NOT_CONFIGURED");

    const dailyLimit = entitlement.isPro ? config.proDailyLimit : config.freeDailyLimit;
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const reservation = await db.$transaction(async (transaction) => {
      // Serialize reservations across server processes before calling the paid
      // provider. The transaction ends before the potentially slow AI request.
      await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.userId} FOR UPDATE`;
      const usedToday = await transaction.usageEvent.count({
        where: { userId: session.userId, name: usageEventName, createdAt: { gte: startOfToday } },
      });
      if (usedToday >= dailyLimit) return null;
      const event = await transaction.usageEvent.create({
        data: {
          userId: session.userId,
          name: usageEventName,
          metadata: {
            imageCount: payload.images.length,
            tone: payload.tone,
            platform: payload.platform,
            plan: entitlement.isPro ? "pro" : "free",
          },
        },
      });
      return { id: event.id, used: usedToday + 1 };
    });
    if (!reservation) {
      return fail("Bạn đã dùng hết lượt AI hôm nay. Lượt mới sẽ mở vào ngày mai.", 429, "AI_DAILY_LIMIT");
    }

    try {
      const result = await generateSocialCaptions(payload, config);
      return ok({ ...result, usage: { used: reservation.used, limit: dailyLimit } });
    } catch (error) {
      // A provider failure should not consume the user's daily allowance.
      await db.usageEvent.delete({ where: { id: reservation.id } });
      throw error;
    }
  } catch (error) {
    if (error instanceof AICaptionProviderError) return fail(error.message, 502, "AI_PROVIDER_ERROR");
    return apiError(error);
  }
}
