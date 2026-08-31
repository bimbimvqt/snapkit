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
    prisma.appConfig.upsert({
      where: { key: "mobile" },
      update: {},
      create: {
        key: "mobile",
        value: {
          minVersion: "1.0.0",
          maintenance: false,
          adMode: "test",
          interstitialEvery: 3,
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
          title: "Nâng cấp Snapkit Pro",
          subtitle: "Mở khoá toàn bộ công cụ, dọn thư viện nhanh hơn và sử dụng Snapkit không quảng cáo.",
          footer: "Thanh toán được xử lý an toàn qua App Store hoặc Google Play. Bạn có thể huỷ bất kỳ lúc nào.",
          plans: [
            {
              id: "monthly",
              productId: "snapkit_pro_monthly",
              name: "Pro hàng tháng",
              badge: "Phổ biến",
              price: 79000,
              currency: "VND",
              priceLabel: "79.000đ",
              periodLabel: "/ tháng",
              trialDays: 7,
              ctaLabel: "Dùng thử 7 ngày",
              description: "Linh hoạt, đầy đủ tính năng Pro và có thể huỷ bất kỳ lúc nào.",
              features: ["Không quảng cáo", "Quét thư viện lớn", "QR style premium", "Ưu tiên tính năng mới"],
              benefits: ["Khôi phục giao dịch", "Thanh toán bảo mật qua cửa hàng ứng dụng"],
              highlighted: true,
              enabled: true,
              sortOrder: 0,
            },
            {
              id: "yearly",
              productId: "snapkit_pro_yearly",
              name: "Pro hàng năm",
              badge: "Tiết kiệm",
              price: 599000,
              currency: "VND",
              priceLabel: "599.000đ",
              periodLabel: "/ năm",
              trialDays: 7,
              ctaLabel: "Chọn gói năm",
              description: "Trọn một năm Pro với chi phí tốt hơn so với thanh toán từng tháng.",
              features: ["Toàn bộ quyền lợi gói tháng", "Tiết kiệm chi phí", "Không quảng cáo", "QR style premium"],
              benefits: ["Khôi phục giao dịch", "Thanh toán bảo mật qua cửa hàng ứng dụng"],
              highlighted: false,
              enabled: true,
              sortOrder: 1,
            },
          ],
        },
      },
    }),
  ]);
}

main().finally(() => prisma.$disconnect());
