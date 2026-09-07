import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), upsert: vi.fn(), findAssets: vi.fn(), createAssets: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.session }));
vi.mock("@/lib/db", () => ({ db: {
  mediaScan: { upsert: mocks.upsert },
  mediaScanAsset: { findMany: mocks.findAssets, createMany: mocks.createAssets },
} }));
import { POST } from "./route";

const payload = {
  clientScanId: "123e4567-e89b-42d3-a456-426614174000", deviceId: "device-12345678",
  scannedCount: 1, imageCount: 1, videoCount: 0, duplicateCount: 0, screenshotCount: 0, largeVideoCount: 0,
  durationMs: 100, maxScanAssets: 500, similarImageLimit: 180, largeVideoThresholdMb: 100, assets: [],
};
function request() {
  return new Request("http://localhost/api/v1/media-scans", { method: "POST", body: JSON.stringify(payload) });
}

describe("media scan ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ userId: "owner" });
    mocks.upsert.mockResolvedValue({ id: "scan-1" });
  });

  it("binds creation and repeated batches to the authenticated user", async () => {
    expect((await POST(request())).status).toBe(201);
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { deviceId_clientScanId: { deviceId: payload.deviceId, clientScanId: payload.clientScanId }, userId: "owner" },
      update: expect.not.objectContaining({ userId: expect.anything() }),
      create: expect.objectContaining({ userId: "owner" }),
    });
  });

  it("returns a conflict when a foreign scan already occupies the device/scan identity", async () => {
    mocks.upsert.mockImplementation(async ({ where }) => {
      // Prisma must not match a victim's row through the compound key alone.
      if (where.userId) throw new Prisma.PrismaClientKnownRequestError("Duplicate scan", { code: "P2002", clientVersion: "6.19.0" });
      return { id: "victim-scan" };
    });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(mocks.findAssets).not.toHaveBeenCalled();
    expect(mocks.createAssets).not.toHaveBeenCalled();
  });

  it("rejects anonymous batch writes", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
