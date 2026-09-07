import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  subscription: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    appConfig: { findUnique: mocks.config },
    subscription: { findFirst: mocks.subscription },
  },
}));

import { defaultSubscriptionConfig } from "./subscription-plans";

import { mediaStorageEntitlement } from "./media-subscription";

describe("media storage subscription entitlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.mockResolvedValue(null);
  });

  it("maps an active store product to its Pro storage policy", async () => {
    mocks.subscription.mockResolvedValue({ productId: "snapkit_pro_monthly" });
    await expect(mediaStorageEntitlement("user-1")).resolves.toMatchObject({
      planId: "monthly",
      isPro: true,
      policy: { quotaMb: 10240, originalVideoRetentionDays: 30 },
    });
  });

  it("keeps paid access when the plan is hidden from the paywall", async () => {
    mocks.config.mockResolvedValue({
      value: {
        ...defaultSubscriptionConfig,
        plans: defaultSubscriptionConfig.plans.map((plan) => ({ ...plan, enabled: false })),
      },
    });
    mocks.subscription.mockResolvedValue({ productId: "snapkit_pro_monthly" });
    await expect(mediaStorageEntitlement("user-1")).resolves.toMatchObject({
      planId: "monthly", isPro: true, policy: { quotaMb: 10240 },
    });
  });

  it("uses the Free policy for an unknown or missing subscription", async () => {
    mocks.subscription.mockResolvedValue({ productId: "retired_product" });
    await expect(mediaStorageEntitlement("user-1")).resolves.toMatchObject({
      planId: "free",
      isPro: false,
      policy: { quotaMb: 100, maxVideoUploadMb: 50, previewRetentionDays: 7, originalVideoRetentionDays: 0 },
    });
  });
});
