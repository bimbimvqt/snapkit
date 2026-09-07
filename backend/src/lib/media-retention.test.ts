import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), count: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { mediaScanAsset: { findMany: mocks.find, count: mocks.count, updateMany: mocks.update } } }));
vi.mock("@/lib/media-storage", () => ({ removeStoredPreview: mocks.remove }));
import { cleanupExpiredMedia, pendingUploadGraceMs } from "./media-retention";

const now = new Date("2026-09-07T10:00:00Z");
const expired = new Date(now.getTime() - pendingUploadGraceMs - 1);
const emptyAsset = {
  previewStorageKey: null, previewExpiresAt: null,
  originalStorageKey: null, originalExpiresAt: null,
  pendingStorageKey: null, pendingExpiresAt: null,
};

describe("media retention across shared object references", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.count.mockResolvedValue(0);
    mocks.update.mockResolvedValue({ count: 1 });
    mocks.remove.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it("keeps an active preview when an abandoned upload references the same object", async () => {
    mocks.find.mockResolvedValue([{ ...emptyAsset, pendingStorageKey: "r2:shared.jpg", pendingExpiresAt: expired }]);
    mocks.count.mockResolvedValue(1);
    expect(await cleanupExpiredMedia()).toEqual({ deletedObjects: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.count).toHaveBeenCalledWith({ where: { OR: [
      { previewStorageKey: "r2:shared.jpg", OR: [{ previewExpiresAt: null }, { previewExpiresAt: { gt: now } }] },
      { originalStorageKey: "r2:shared.jpg", OR: [{ originalExpiresAt: null }, { originalExpiresAt: { gt: now } }] },
      { pendingStorageKey: "r2:shared.jpg", OR: [{ pendingExpiresAt: null }, { pendingExpiresAt: { gt: new Date(now.getTime() - pendingUploadGraceMs) } }] },
    ] } });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { pendingStorageKey: "r2:shared.jpg", pendingExpiresAt: { lte: new Date(now.getTime() - pendingUploadGraceMs) } },
      data: { pendingStorageKey: null, pendingMimeType: null, pendingBytes: null, pendingExpiresAt: null },
    });
  });

  it("lets uploads complete within the same grace period as the completion endpoint", async () => {
    mocks.find.mockResolvedValue([{ ...emptyAsset, pendingStorageKey: "r2:upload.mov", pendingExpiresAt: new Date(now.getTime() - 60_000) }]);
    await cleanupExpiredMedia();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it("removes a fully expired object once even when several fields reference it", async () => {
    mocks.find.mockResolvedValue([
      { ...emptyAsset, previewStorageKey: "r2:expired.mp4", previewExpiresAt: expired },
      { ...emptyAsset, originalStorageKey: "r2:expired.mp4", originalExpiresAt: expired, pendingStorageKey: "r2:expired.mp4", pendingExpiresAt: expired },
    ]);
    expect(await cleanupExpiredMedia()).toEqual({ deletedObjects: 1 });
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith("r2:expired.mp4");
    expect(mocks.update).toHaveBeenCalledTimes(3);
    for (const [args] of mocks.update.mock.calls) {
      expect(Object.keys(args.where).some((field) => field.endsWith("ExpiresAt"))).toBe(true);
    }
  });
});
