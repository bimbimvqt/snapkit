import { describe, expect, it } from "vitest";
import { mobileConfigWithDefaults } from "./mobile-config";

describe("mobile config defaults", () => {
  it("enables production media sync when the stored config predates cleaner settings", () => {
    expect(mobileConfigWithDefaults({ maintenance: false }).cleaner).toMatchObject({
      adminSyncEnabled: true,
      adminSyncLimit: 500,
      adminImagePreviewMaxPx: 1920,
    });
  });

  it("preserves admin-managed cleaner settings", () => {
    expect(
      mobileConfigWithDefaults({ cleaner: { adminSyncEnabled: false, adminSyncLimit: 120 } }).cleaner,
    ).toMatchObject({ adminSyncEnabled: false, adminSyncLimit: 120, maxScanAssets: 500 });
  });
});
