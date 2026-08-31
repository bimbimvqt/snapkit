import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  transcodeBrowserVideo: vi.fn(),
  storedPreview: vi.fn(),
  removeStoredPreview: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/db", () => ({
  db: { mediaScanAsset: { findUnique: mocks.findUnique, update: mocks.update } },
}));
vi.mock("@/lib/media-storage", () => ({
  browserVideoStorageKeyFor: (id: string) => `preview/${id}.mp4`,
  extensionForMimeType: () => "mp4",
  parseByteRange: () => ({ start: 0, end: 99 }),
  previewStream: () => new ReadableStream({ start(controller) { controller.close(); } }),
  removeStoredPreview: mocks.removeStoredPreview,
  storedPreview: mocks.storedPreview,
  transcodeBrowserVideo: mocks.transcodeBrowserVideo,
}));

import { GET } from "./route";

describe("admin video preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ userId: "admin-1", role: "ADMIN" });
    mocks.storedPreview.mockResolvedValue({ filePath: "/media/preview/video.mp4", size: 1_000 });
  });

  it("converts a legacy original to a browser MP4 before streaming it", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "video-1",
      type: "VIDEO",
      previewStorageKey: null,
      previewMimeType: null,
      originalStorageKey: "legacy/video-1.mov",
    });
    mocks.transcodeBrowserVideo.mockResolvedValue(900);
    mocks.update.mockResolvedValue({ id: "video-1" });

    const response = await GET(
      new Request("http://localhost/api/admin/media-scans/assets/video-1/preview", {
        headers: { range: "bytes=0-99" },
      }),
      { params: Promise.resolve({ id: "video-1" }) },
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(mocks.transcodeBrowserVideo).toHaveBeenCalledWith("legacy/video-1.mov", "preview/video-1.mp4");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "video-1" },
      data: {
        previewStorageKey: "preview/video-1.mp4",
        previewMimeType: "video/mp4",
        previewBytes: BigInt(900),
      },
    });
  });

  it("streams an existing browser preview without transcoding again", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "video-2",
      type: "VIDEO",
      previewStorageKey: "preview/video-2.mp4",
      previewMimeType: "video/mp4",
      originalStorageKey: "original/video-2.mov",
    });

    const response = await GET(
      new Request("http://localhost/api/admin/media-scans/assets/video-2/preview", {
        headers: { range: "bytes=0-99" },
      }),
      { params: Promise.resolve({ id: "video-2" }) },
    );

    expect(response.status).toBe(206);
    expect(mocks.transcodeBrowserVideo).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
