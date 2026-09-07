import { describe, expect, it } from "vitest";
import { defaultSubscriptionConfig, parseSubscriptionConfig } from "./subscription-plans";

describe("subscription plan defaults", () => {
  it("uses the cost-controlled Free policy and highlights annual Pro", () => {
    expect(defaultSubscriptionConfig.freeStorage).toEqual({
      quotaMb: 100,
      maxVideoUploadMb: 50,
      previewRetentionDays: 7,
      originalVideoRetentionDays: 0,
    });
    expect(defaultSubscriptionConfig.plans.find((plan) => plan.id === "monthly")).toMatchObject({
      highlighted: false,
      trialDays: 0,
      storage: { quotaMb: 10_240, previewRetentionDays: 90, originalVideoRetentionDays: 30 },
    });
    expect(defaultSubscriptionConfig.plans.find((plan) => plan.id === "yearly")).toMatchObject({
      highlighted: true,
      trialDays: 7,
      storage: { quotaMb: 25_600, previewRetentionDays: 365, originalVideoRetentionDays: 90 },
    });
  });

  it("migrates the previous unversioned plans without overwriting unknown plans", () => {
    const migrated = parseSubscriptionConfig({
      title: "Legacy",
      subtitle: "Legacy subscription configuration",
      footer: "Legacy footer",
      freeStorage: {
        quotaMb: 512,
        maxVideoUploadMb: 200,
        previewRetentionDays: 30,
        originalVideoRetentionDays: 0,
      },
      plans: [
        { ...defaultSubscriptionConfig.plans[0], badge: "Old monthly", highlighted: true, trialDays: 7 },
        { ...defaultSubscriptionConfig.plans[1], badge: "Old yearly", highlighted: false },
        {
          ...defaultSubscriptionConfig.plans[0],
          id: "team",
          productId: "snapkit_team",
          name: "Team",
          highlighted: false,
        },
      ],
    });

    expect(migrated.version).toBe(2);
    expect(migrated.freeStorage.quotaMb).toBe(100);
    expect(migrated.plans.find((plan) => plan.id === "monthly")).toEqual(defaultSubscriptionConfig.plans[0]);
    expect(migrated.plans.find((plan) => plan.id === "yearly")).toEqual(defaultSubscriptionConfig.plans[1]);
    expect(migrated.plans.find((plan) => plan.id === "team")?.name).toBe("Team");
  });
});
