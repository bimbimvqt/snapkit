import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  removeStoredPreview: vi.fn(),
  transcodeBrowserVideo: vi.fn(),
  entitlement: vi.fn(),
  headR2Object: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db", () => ({
  db: { mediaScanAsset: { findUnique: mocks.findUnique, update: mocks.update } },
}));
vi.mock("@/lib/media-storage", () => ({
  removeStoredPreview: mocks.removeStoredPreview,
  transcodeBrowserVideo: mocks.transcodeBrowserVideo,
}));
vi.mock("@/lib/media-subscription", () => ({
  mediaStorageEntitlement: mocks.entitlement,
  retentionDate: () => new Date("2026-09-30T00:00:00.000Z"),
}));
vi.mock("@/lib/r2-storage", () => ({
  headR2Object: mocks.headR2Object,
  mediaR2Reference: vi.fn(),
  r2Configured: () => true,
}));

import { POST } from "./route";

describe("complete direct R2 media upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ userId: "user-1", role: "USER" });
    mocks.findUnique.mockResolvedValue({
      id: "asset-1",
      type: "IMAGE",
      previewStorageKey: null,
      originalStorageKey: null,
      pendingStorageKey: "r2:snapkit/users/user-1/assets/asset-1/preview.jpg",
      pendingMimeType: "image/jpeg",
      pendingBytes: BigInt(1000),
      pendingExpiresAt: new Date(Date.now() + 60_000),
      scan: { userId: "user-1" },
    });
    mocks.headR2Object.mockResolvedValue({ size: 1000, mimeType: "image/jpeg" });
    mocks.entitlement.mockResolvedValue({
      planId: "free",
      policy: { previewRetentionDays: 30, originalVideoRetentionDays: 0 },
    });
    mocks.transcodeBrowserVideo.mockResolvedValue(700);
    mocks.removeStoredPreview.mockResolvedValue(undefined);
    mocks.update.mockResolvedValue({ id: "asset-1" });
  });

  it("verifies the object before publishing it as the image preview", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/media-scans/assets/asset-1/upload/complete", { method: "POST" }),
      { params: Promise.resolve({ id: "asset-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.headR2Object).toHaveBeenCalledWith("r2:snapkit/users/user-1/assets/asset-1/preview.jpg");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: {
        previewStorageKey: "r2:snapkit/users/user-1/assets/asset-1/preview.jpg",
        previewMimeType: "image/jpeg",
        previewBytes: BigInt(1000),
        previewExpiresAt: new Date("2026-09-30T00:00:00.000Z"),
        pendingStorageKey: null,
        pendingMimeType: null,
        pendingBytes: null,
        pendingExpiresAt: null,
      },
    });
  });

  it("does not publish an incomplete object", async () => {
    mocks.headR2Object.mockResolvedValue({ size: 900, mimeType: "image/jpeg" });
    const response = await POST(
      new Request("http://localhost/api/v1/media-scans/assets/asset-1/upload/complete", { method: "POST" }),
      { params: Promise.resolve({ id: "asset-1" }) },
    );

    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("publishes video metadata only after the browser preview is ready", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "asset-1",
      type: "VIDEO",
      previewStorageKey: null,
      originalStorageKey: null,
      pendingStorageKey: "r2:snapkit/users/user-1/assets/asset-1/original.mov",
      pendingMimeType: "video/quicktime",
      pendingBytes: BigInt(1000),
      pendingExpiresAt: new Date(Date.now() + 60_000),
      scan: { userId: "user-1" },
    });
    mocks.headR2Object.mockResolvedValue({ size: 1000, mimeType: "video/quicktime" });
    const { mediaR2Reference } = await import("@/lib/r2-storage");
    vi.mocked(mediaR2Reference).mockReturnValue("r2:snapkit/users/user-1/assets/asset-1/preview.mp4");

    const response = await POST(
      new Request("http://localhost/api/v1/media-scans/assets/asset-1/upload/complete", { method: "POST" }),
      { params: Promise.resolve({ id: "asset-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.transcodeBrowserVideo).toHaveBeenCalledWith(
      "r2:snapkit/users/user-1/assets/asset-1/original.mov",
      "r2:snapkit/users/user-1/assets/asset-1/preview.mp4",
    );
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: expect.objectContaining({
        previewStorageKey: "r2:snapkit/users/user-1/assets/asset-1/preview.mp4",
        previewMimeType: "video/mp4",
        previewBytes: BigInt(700),
        originalStorageKey: null,
        pendingStorageKey: null,
      }),
    });
  });

  it("keeps the pending upload retryable when video transcoding fails", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "asset-1",
      type: "VIDEO",
      previewStorageKey: null,
      originalStorageKey: null,
      pendingStorageKey: "r2:snapkit/users/user-1/assets/asset-1/original.mov",
      pendingMimeType: "video/quicktime",
      pendingBytes: BigInt(1000),
      pendingExpiresAt: new Date(Date.now() + 60_000),
      scan: { userId: "user-1" },
    });
    mocks.headR2Object.mockResolvedValue({ size: 1000, mimeType: "video/quicktime" });
    mocks.transcodeBrowserVideo.mockRejectedValue(new Error("VIDEO_TRANSCODE_FAILED"));

    const response = await POST(
      new Request("http://localhost/api/v1/media-scans/assets/asset-1/upload/complete", { method: "POST" }),
      { params: Promise.resolve({ id: "asset-1" }) },
    );

    expect(response.status).toBe(500);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
