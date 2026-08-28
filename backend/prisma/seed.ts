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
  ]);
}

main().finally(() => prisma.$disconnect());
