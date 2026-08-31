import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUnique: vi.fn(),
  storedPreview: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db", () => ({ db: { mediaScanAsset: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/media-storage", () => ({
  extensionForMimeType: () => "mov",
  parseByteRange: () => ({ start: 100, end: 199 }),
  previewStream: () => new ReadableStream({ start(controller) { controller.close(); } }),
  storedPreview: mocks.storedPreview,
}));

import { GET } from "./route";

describe("admin media download", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ userId: "admin-1", role: "ADMIN" });
    mocks.storedPreview.mockResolvedValue({ filePath: "/media/original/video.mov", size: 1_000 });
  });

  it("downloads the original video and supports byte ranges", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "video-1",
      type: "VIDEO",
      originalStorageKey: "original/video-1.mov",
      originalMimeType: "video/quicktime",
      originalExpiresAt: null,
      previewStorageKey: "preview/video-1.mp4",
      previewMimeType: "video/mp4",
      previewExpiresAt: null,
    });

    const response = await GET(
      new Request("http://localhost/api/admin/media-scans/assets/video-1/download", {
        headers: { range: "bytes=100-199" },
      }),
      { params: Promise.resolve({ id: "video-1" }) },
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/quicktime");
    expect(response.headers.get("content-range")).toBe("bytes 100-199/1000");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(mocks.storedPreview).toHaveBeenCalledWith("original/video-1.mov");
  });
});
