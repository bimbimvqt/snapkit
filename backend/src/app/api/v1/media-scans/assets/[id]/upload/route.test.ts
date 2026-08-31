import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  entitlement: vi.fn(),
  usage: vi.fn(),
  cleanup: vi.fn(),
  r2Configured: vi.fn(),
  createR2Upload: vi.fn(),
  mediaR2Reference: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db", () => ({
  db: { mediaScanAsset: { findUnique: mocks.findUnique, update: mocks.update } },
}));
vi.mock("@/lib/media-subscription", () => ({
  mediaStorageEntitlement: mocks.entitlement,
  userMediaStorageBytes: mocks.usage,
}));
vi.mock("@/lib/media-retention", () => ({ cleanupExpiredMedia: mocks.cleanup }));
vi.mock("@/lib/r2-storage", () => ({
  createR2Upload: mocks.createR2Upload,
  mediaR2Reference: mocks.mediaR2Reference,
  r2Configured: mocks.r2Configured,
}));

import { POST } from "./route";

const freeEntitlement = {
  planId: "free",
  isPro: false,
  productId: null,
  policy: {
    quotaMb: 512,
    maxVideoUploadMb: 200,
    previewRetentionDays: 30,
    originalVideoRetentionDays: 0,
  },
};

describe("media direct upload preparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ userId: "user-1", role: "USER" });
    mocks.findUnique.mockResolvedValue({
      id: "asset-1",
      type: "IMAGE",
      pendingBytes: null,
      previewBytes: null,
      originalBytes: null,
      scan: { userId: "user-1" },
    });
    mocks.entitlement.mockResolvedValue(freeEntitlement);
    mocks.usage.mockResolvedValue(0);
    mocks.cleanup.mockResolvedValue({ deletedObjects: 0 });
    mocks.r2Configured.mockReturnValue(false);
    mocks.mediaR2Reference.mockReturnValue("r2:snapkit/users/user-1/assets/asset-1/preview.jpg");
    mocks.createR2Upload.mockResolvedValue({
      url: "https://r2.example/upload",
      expiresAt: new Date("2026-08-31T15:00:00.000Z"),
      headers: { "content-type": "image/jpeg", "content-length": "1000" },
    });
  });

  it("falls back to the authenticated proxy when R2 is not configured", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/media-scans/assets/asset-1/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mimeType: "image/jpeg", bytes: 1000 }),
      }),
      { params: Promise.resolve({ id: "asset-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { mode: "proxy", uploadUrl: "/api/v1/media-scans/assets/asset-1/preview" },
    });
  });

  it("rejects an upload that exceeds the active plan quota", async () => {
    mocks.usage.mockResolvedValue(512 * 1024 * 1024);
    const response = await POST(
      new Request("http://localhost/api/v1/media-scans/assets/asset-1/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mimeType: "image/jpeg", bytes: 1000 }),
      }),
      { params: Promise.resolve({ id: "asset-1" }) },
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "STORAGE_QUOTA_EXCEEDED" } });
  });

  it("reserves an object and returns a direct presigned R2 upload", async () => {
    mocks.r2Configured.mockReturnValue(true);
    mocks.update.mockResolvedValue({ id: "asset-1" });
    const response = await POST(
      new Request("http://localhost/api/v1/media-scans/assets/asset-1/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mimeType: "image/jpeg", bytes: 1000 }),
      }),
      { params: Promise.resolve({ id: "asset-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { mode: "direct", uploadUrl: "https://r2.example/upload", plan: { id: "free" } },
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: {
        pendingStorageKey: "r2:snapkit/users/user-1/assets/asset-1/preview.jpg",
        pendingMimeType: "image/jpeg",
        pendingBytes: BigInt(1000),
        pendingExpiresAt: new Date("2026-08-31T15:00:00.000Z"),
      },
    });
  });
});
