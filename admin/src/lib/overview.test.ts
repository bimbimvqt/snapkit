import { describe, expect, it } from "vitest";
import { normalizeOverview } from "./overview";

describe("overview API compatibility", () => {
  it("normalizes the production legacy response without crashing", () => {
    const data = normalizeOverview({
      users: 12,
      activeSubscriptions: 3,
      qrCreated: 8,
      cleanups: 4,
      bytesFreed: 1024,
      events: [{ name: "app_open", count: 9 }],
    }, new Date("2026-08-31T03:00:00.000Z"));

    expect(data.apiVersion).toBe("legacy");
    expect(data.period.end).toBe("2026-08-31T03:00:00.000Z");
    expect(data.audience.totalUsers).toBe(12);
    expect(data.engagement.totalEvents).toBe(9);
    expect(data.storage).toBeNull();
  });

  it("keeps analytics and remote storage from the current response", () => {
    const data = normalizeOverview({
      period: { days: 30, start: "2026-08-01T00:00:00.000Z", end: "2026-08-31T00:00:00.000Z" },
      audience: { totalUsers: 5, activeUsers: 2 },
      engagement: { events: [], platforms: [] },
      productivity: { qrCreated: 2 },
      media: {},
      storage: {
        sourceHost: "45.119.214.94",
        totalBytes: 100,
        usedBytes: 40,
        freeBytes: 60,
        usedPercent: 40,
        r2: {
          bucket: "snap-kit",
          prefix: "snapkit-media/",
          usedBytes: 25,
          objectCount: 3,
          measuredAt: "2026-08-31T04:00:00.000Z",
          source: "bucket",
        },
      },
      trend: [],
    });

    expect(data.apiVersion).toBe("analytics_v2");
    expect(data.storage).toMatchObject({ sourceHost: "45.119.214.94", usedPercent: 40 });
    expect(data.storage?.r2).toEqual({
      bucket: "snap-kit",
      prefix: "snapkit-media/",
      usedBytes: 25,
      objectCount: 3,
      measuredAt: "2026-08-31T04:00:00.000Z",
      source: "bucket",
    });
  });
});
