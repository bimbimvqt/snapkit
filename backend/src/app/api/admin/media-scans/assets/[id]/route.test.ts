import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  createAudit: vi.fn(),
  removeStoredPreview: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/media-storage", () => ({ removeStoredPreview: mocks.removeStoredPreview }));
vi.mock("@/lib/db", () => ({
  db: {
    mediaScanAsset: { findUnique: mocks.findUnique, findMany: mocks.findMany },
    $transaction: async (callback: (transaction: unknown) => unknown) => callback({
      mediaScanAsset: { deleteMany: mocks.deleteMany },
      auditLog: { create: mocks.createAudit },
    }),
  },
}));

import { DELETE } from "./route";

describe("admin media deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ userId: "admin-1", role: "ADMIN" });
  });

  it("deletes repeated scan records, stored previews and writes an audit entry", async () => {
    mocks.findUnique.mockResolvedValue({ id: "asset-2", deviceAssetKey: "device-media", type: "VIDEO", scan: { deviceId: "device-1" } });
    mocks.findMany.mockResolvedValue([
      { id: "asset-1", previewStorageKey: "a/asset-1.mp4", previewBytes: BigInt(100) },
      { id: "asset-2", previewStorageKey: "b/asset-2.mp4", previewBytes: BigInt(200) },
    ]);
    mocks.deleteMany.mockResolvedValue({ count: 2 });
    mocks.createAudit.mockResolvedValue({ id: "audit-1" });

    const response = await DELETE(new Request("http://localhost/api/admin/media-scans/assets/asset-2", { method: "DELETE" }), { params: Promise.resolve({ id: "asset-2" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { id: "asset-2", deletedRecords: 2 } });
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["asset-1", "asset-2"] } } });
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "media_scan_asset.delete", entityId: "asset-2" }) }));
    expect(mocks.removeStoredPreview).toHaveBeenCalledTimes(2);
  });

  it("returns not found without mutating storage", async () => {
    mocks.findUnique.mockResolvedValue(null);
    const response = await DELETE(new Request("http://localhost/api/admin/media-scans/assets/missing", { method: "DELETE" }), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.removeStoredPreview).not.toHaveBeenCalled();
  });
});
