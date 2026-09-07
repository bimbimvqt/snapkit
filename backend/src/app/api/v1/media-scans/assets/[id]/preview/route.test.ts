import { mkdtemp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), update: vi.fn(), transcode: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.session }));
vi.mock("@/lib/db", () => ({ db: { mediaScanAsset: { findUnique: mocks.find, update: mocks.update } } }));
vi.mock("@/lib/media-storage", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/media-storage")>(), transcodeBrowserVideo: mocks.transcode,
}));
vi.mock("@/lib/media-retention", () => ({ cleanupExpiredMedia: async () => ({ deletedObjects: 0 }) }));
vi.mock("@/lib/media-subscription", () => ({
  userMediaStorageBytes: async () => 0,
  mediaStorageEntitlement: async () => ({ policy: { quotaMb: 1, maxVideoUploadMb: 1, previewRetentionDays: 3, originalVideoRetentionDays: 0 } }),
  retentionDate: (days: number) => new Date(Date.now() + days * 86_400_000),
}));
import { PUT } from "./route";

const asset = { id: "asset-1", type: "IMAGE", previewStorageKey: null, previewBytes: null, originalStorageKey: null, originalBytes: null, scan: { userId: "owner" } };
const context = { params: Promise.resolve({ id: asset.id }) };
let directory: string;

describe("proxy upload stream quota", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    directory = await mkdtemp(path.join(tmpdir(), "snapkit-upload-test-"));
    vi.stubEnv("MEDIA_STORAGE_DIR", directory);
    mocks.session.mockResolvedValue({ userId: "owner" });
    mocks.find.mockResolvedValue(asset);
    mocks.update.mockResolvedValue({ id: asset.id });
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  });

  it("rejects bytes beyond the Content-Length used for the quota reservation", async () => {
    const response = await PUT(new Request("http://localhost/upload", {
      method: "PUT", headers: { "content-type": "image/jpeg", "content-length": "1" }, body: "oversized",
    }), context);
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("PREVIEW_TOO_LARGE");
    expect(mocks.update).not.toHaveBeenCalled();
    const files = await readdir(directory, { recursive: true });
    expect(files.some((file) => file.endsWith(".jpg") || file.endsWith(".upload"))).toBe(false);
  });

  it("stores a payload inside the reserved size and persists the actual byte count", async () => {
    const response = await PUT(new Request("http://localhost/upload", {
      method: "PUT", headers: { "content-type": "image/jpeg", "content-length": "3" }, body: "abc",
    }), context);
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: asset.id }, data: expect.objectContaining({ previewBytes: BigInt(3) }) });
  });

  it("keeps a finite retention date on temporary free-plan originals if transcoding fails", async () => {
    mocks.find.mockResolvedValue({ ...asset, type: "VIDEO" });
    mocks.transcode.mockRejectedValue(new Error("VIDEO_TRANSCODE_FAILED"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await PUT(new Request("http://localhost/upload", {
      method: "PUT", headers: { "content-type": "video/mp4", "content-length": "3" }, body: "abc",
    }), context);
    logged.mockRestore();
    expect(response.status).toBe(500);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: asset.id }, data: expect.objectContaining({ originalExpiresAt: expect.any(Date) }) });
  });
});
