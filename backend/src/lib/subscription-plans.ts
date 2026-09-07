import { z } from "zod";

const planIdSchema = z.string().trim().min(2, "Mã gói phải có ít nhất 2 ký tự").max(40).regex(/^[a-z0-9_-]+$/, "Mã gói chỉ gồm chữ thường, số, _ hoặc -");

export const freeStoragePolicy = {
  quotaMb: 100,
  maxVideoUploadMb: 50,
  previewRetentionDays: 7,
  originalVideoRetentionDays: 0,
} as const;

export const proStoragePolicy = {
  quotaMb: 10_240,
  maxVideoUploadMb: 512,
  previewRetentionDays: 90,
  originalVideoRetentionDays: 30,
} as const;

export const storagePolicySchema = z.object({
  quotaMb: z.number().int().min(50).max(1_048_576),
  maxVideoUploadMb: z.number().int().min(0).max(4_096),
  previewRetentionDays: z.number().int().min(1).max(3_650),
  originalVideoRetentionDays: z.number().int().min(0).max(3_650),
});

export const subscriptionPlanSchema = z.object({
  id: planIdSchema,
  productId: z.string().trim().min(3, "Product ID không hợp lệ").max(120),
  name: z.string().trim().min(2, "Tên gói phải có ít nhất 2 ký tự").max(60),
  badge: z.string().trim().max(32).default(""),
  price: z.number().int().min(0).max(1_000_000_000),
  currency: z.string().trim().length(3, "Mã tiền tệ phải gồm 3 ký tự").transform((value) => value.toUpperCase()),
  priceLabel: z.string().trim().min(1).max(32),
  periodLabel: z.string().trim().min(1).max(32),
  trialDays: z.number().int().min(0).max(365),
  ctaLabel: z.string().trim().min(2).max(48),
  description: z.string().trim().min(2).max(180),
  features: z.array(z.string().trim().min(1).max(100)).min(1, "Mỗi gói cần ít nhất một tính năng").max(16),
  benefits: z.array(z.string().trim().min(1).max(100)).max(8),
  highlighted: z.boolean(),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(100),
  storage: storagePolicySchema.default(proStoragePolicy),
});

export const subscriptionConfigSchema = z
  .object({
    version: z.literal(2).default(2),
    title: z.string().trim().min(2).max(80),
    subtitle: z.string().trim().min(2).max(220),
    footer: z.string().trim().max(180),
    freeStorage: storagePolicySchema.default(freeStoragePolicy),
    plans: z.array(subscriptionPlanSchema).min(1, "Cần ít nhất một gói Pro").max(6),
  })
  .superRefine((input, context) => {
    const ids = new Set<string>();
    const productIds = new Set<string>();
    let highlightedCount = 0;
    input.plans.forEach((plan, index) => {
      if (ids.has(plan.id)) context.addIssue({ code: "custom", message: "Mã gói không được trùng", path: ["plans", index, "id"] });
      if (productIds.has(plan.productId)) context.addIssue({ code: "custom", message: "Product ID không được trùng", path: ["plans", index, "productId"] });
      ids.add(plan.id);
      productIds.add(plan.productId);
      if (plan.highlighted) highlightedCount += 1;
    });
    if (highlightedCount > 1) context.addIssue({ code: "custom", message: "Chỉ được chọn một gói nổi bật", path: ["plans"] });
  });

export type SubscriptionConfig = z.infer<typeof subscriptionConfigSchema>;

export const defaultSubscriptionConfig: SubscriptionConfig = {
  version: 2,
  title: "Nâng cấp Snapkit Pro",
  subtitle: "Dọn dẹp không giới hạn, không quảng cáo và lưu media an toàn trên cloud.",
  footer: "Thanh toán được xử lý an toàn qua App Store hoặc Google Play. Bạn có thể huỷ bất kỳ lúc nào.",
  freeStorage: freeStoragePolicy,
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
      storage: proStoragePolicy,
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
        ...proStoragePolicy,
        quotaMb: 25_600,
        previewRetentionDays: 365,
        originalVideoRetentionDays: 90,
      },
    },
  ],
};

export function parseSubscriptionConfig(input: unknown): SubscriptionConfig {
  const parsed = subscriptionConfigSchema.safeParse(input);
  if (!parsed.success) return defaultSubscriptionConfig;
  if (hasCurrentVersion(input)) return parsed.data;
  return {
    ...parsed.data,
    version: 2,
    title: defaultSubscriptionConfig.title,
    subtitle: defaultSubscriptionConfig.subtitle,
    footer: defaultSubscriptionConfig.footer,
    freeStorage: freeStoragePolicy,
    plans: parsed.data.plans.map((plan) => {
      const current = defaultSubscriptionConfig.plans.find((candidate) => candidate.id === plan.id);
      return current ?? plan;
    }),
  };
}

function hasCurrentVersion(input: unknown) {
  return input !== null && typeof input === "object" && !Array.isArray(input) && "version" in input && input.version === 2;
}
