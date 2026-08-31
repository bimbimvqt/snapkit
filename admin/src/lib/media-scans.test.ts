import { describe, expect, it } from "vitest";
import { normalizeMediaScanAnalytics } from "./media-scans";

describe("media scan API compatibility", () => {
  it("groups the legacy production response and paginates its assets", () => {
    const legacy = {
      totalScans: 2,
      totalAssets: 2,
      duplicateAssets: 1,
      latest: [
        {
          id: "scan-1",
          deviceId: "device-1…",
          createdAt: "2026-08-31T00:00:00.000Z",
          user: { email: "user@example.com", name: "User" },
          assets: [{ id: "asset-1", type: "IMAGE", categories: ["SIMILAR"], bytes: 100, width: 10, height: 10, hasThumbnail: true }],
        },
        {
          id: "scan-2",
          deviceId: "device-2…",
          createdAt: "2026-08-30T00:00:00.000Z",
          user: { email: "user@example.com", name: "User" },
          assets: [{ id: "asset-2", type: "VIDEO", categories: [], bytes: 200, width: 20, height: 20, hasThumbnail: false }],
        },
      ],
    };

    const data = normalizeMediaScanAnalytics(legacy, { type: "IMAGE", pageSize: 12 });
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]).toMatchObject({ scanCount: 2, assetCount: 2, imageCount: 1, videoCount: 1 });
    expect(data.assets.items).toHaveLength(1);
    expect(data.assets.items[0]).toMatchObject({ id: "asset-1", hasPreview: false });
  });

  it("preserves the current grouped response", () => {
    const current = {
      totalScans: 0,
      totalAssets: 0,
      duplicateAssets: 0,
      groups: [],
      selectedGroupKey: null,
      assets: { items: [], page: 1, pageSize: 24, total: 0, totalPages: 1, type: "ALL" },
    };
    expect(normalizeMediaScanAnalytics(current)).toEqual(current);
  });
});
