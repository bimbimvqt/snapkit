import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@snapkit.local";
  const password = process.env.ADMIN_PASSWORD ?? "admin@123";
  const isProduction = process.env.APP_ENV === "production";
  const minimumPasswordLength = isProduction ? 12 : 8;

  if (
    isProduction &&
    (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD)
  ) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD are required in production",
    );
  }
  if (password.length < minimumPasswordLength) {
    throw new Error(
      `ADMIN_PASSWORD must have at least ${minimumPasswordLength} characters`,
    );
  }

  const passwordHash = await hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {
      name: "Snapkit Admin",
      role: Role.ADMIN,
      disabled: false,
      passwordHash,
    },
    create: { email, name: "Snapkit Admin", role: Role.ADMIN, passwordHash },
  });

  await Promise.all([
    prisma.featureFlag.upsert({
      where: { key: "media_cleaner" },
      update: {},
      create: {
        key: "media_cleaner",
        enabled: true,
        description: "Quét và dọn media trên thiết bị",
      },
    }),
    prisma.featureFlag.upsert({
      where: { key: "qr_studio" },
      update: {},
      create: {
        key: "qr_studio",
        enabled: true,
        description: "Quét và tạo QR đa năng",
      },
    }),
    prisma.featureFlag.upsert({
      where: { key: "pro_paywall" },
      update: {},
      create: {
        key: "pro_paywall",
        enabled: true,
        description: "Hiển thị gói Pro",
      },
    }),
    prisma.featureFlag.upsert({
      where: { key: "ai_caption_studio" },
      update: {},
      create: {
        key: "ai_caption_studio",
        enabled: true,
        description: "Tạo nội dung mạng xã hội từ ảnh bằng AI",
      },
    }),
    prisma.appConfig.upsert({
      where: { key: "ai_caption" },
      update: {},
      create: {
        key: "ai_caption",
        value: {
          enabled: true,
          provider: "openai",
          openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.skytruong.com/v1",
          model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
          temperature: 0.85,
          maxTokens: 1200,
          defaultTone: "meme",
          freeDailyLimit: 3,
          proDailyLimit: 30,
        },
      },
    }),
    prisma.appConfig.upsert({
      where: { key: "mobile" },
      update: {},
      create: {
        key: "mobile",
        value: {
          minVersion: "1.0.0",
          maintenance: false,
          cleaner: {
            maxScanAssets: 500,
            similarImageLimit: 180,
            largeVideoThresholdMb: 100,
            adminSyncEnabled: true,
            adminMediaUploadEnabled: false,
            adminSyncLimit: 100,
            adminImagePreviewMaxPx: 1280,
            adminPreviewMaxFileMb: 50,
          },
          ads: {
            mode: "test",
            bannerEnabled: true,
            interstitialEnabled: true,
            interstitialEvery: 3,
            minimumInterstitialIntervalSeconds: 180,
            nonPersonalizedAds: true,
            androidBannerAdUnitId: "ca-app-pub-5682981484728700/2193696256",
            iosBannerAdUnitId: "ca-app-pub-5682981484728700/6627765287",
            androidInterstitialAdUnitId: "ca-app-pub-5682981484728700/6623895850",
            iosInterstitialAdUnitId: "ca-app-pub-5682981484728700/1072186276",
          },
          proProductId: "snapkit_pro_monthly",
          theme: {
            preset: "midnight_lime",
            mode: "dark",
            navigationStyle: "floating",
          },
        },
      },
    }),
    prisma.appConfig.upsert({
      where: { key: "subscription_plans" },
      update: {},
      create: {
        key: "subscription_plans",
        value: {
          version: 2,
          title: "Nâng cấp Snapkit Pro",
          subtitle: "Dọn dẹp không giới hạn, không quảng cáo và lưu media an toàn trên cloud.",
          footer: "Thanh toán được xử lý an toàn qua App Store hoặc Google Play. Bạn có thể huỷ bất kỳ lúc nào.",
          freeStorage: {
            quotaMb: 100,
            maxVideoUploadMb: 50,
            previewRetentionDays: 7,
            originalVideoRetentionDays: 0,
          },
          plans: [
            {
              id: "monthly",
              productId: "snapkit_pro_monthly",
              name: "Pro hàng tháng",
              badge: "Linh hoạt",
              price: 79000,
              currency: "VND",
              priceLabel: "79.000đ",
              periodLabel: "/ tháng",
              trialDays: 0,
              ctaLabel: "Chọn gói tháng",
              description: "Đầy đủ tính năng Pro, 10 GB cloud và có thể huỷ bất kỳ lúc nào.",
              features: ["Không quảng cáo", "Quét thư viện không giới hạn", "10 GB cloud", "QR style premium"],
              benefits: ["Khôi phục giao dịch", "Thanh toán bảo mật qua cửa hàng ứng dụng"],
              highlighted: false,
              enabled: true,
              sortOrder: 0,
              storage: {
                quotaMb: 10240,
                maxVideoUploadMb: 512,
                previewRetentionDays: 90,
                originalVideoRetentionDays: 30,
              },
            },
            {
              id: "yearly",
              productId: "snapkit_pro_yearly",
              name: "Pro hàng năm",
              badge: "Tiết kiệm 37%",
              price: 599000,
              currency: "VND",
              priceLabel: "599.000đ",
              periodLabel: "/ năm",
              trialDays: 7,
              ctaLabel: "Dùng thử 7 ngày",
              description: "Giá tốt nhất, 25 GB cloud và thời gian lưu media dài hơn.",
              features: ["Không quảng cáo", "Quét thư viện không giới hạn", "25 GB cloud", "Giữ video gốc 90 ngày"],
              benefits: ["Khôi phục giao dịch", "Thanh toán bảo mật qua cửa hàng ứng dụng"],
              highlighted: true,
              enabled: true,
              sortOrder: 1,
              storage: {
                quotaMb: 25600,
                maxVideoUploadMb: 512,
                previewRetentionDays: 365,
                originalVideoRetentionDays: 90,
              },
            },
          ],
        },
      },
    }),
  ]);
}

main().finally(() => prisma.$disconnect());
