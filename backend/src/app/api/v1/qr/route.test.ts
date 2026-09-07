import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.session }));
vi.mock("@/lib/db", () => ({ db: { qrCode: { findMany: mocks.find, create: mocks.create } } }));
import { GET, POST } from "./route";

describe("QR privacy", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.find.mockResolvedValue([]);
    mocks.create.mockResolvedValue({ id: "qr1", createdAt: new Date() });
  });

  it("rejects unauthenticated history reads and writes", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(new Request("http://localhost/api/v1/qr", { method: "POST" }))).status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("scopes all history to the authenticated account", async () => {
    mocks.session.mockResolvedValue({ userId: "owner" });
    expect((await GET()).status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner" } }));
  });

  it("ignores a caller-supplied owner when saving sensitive QR content", async () => {
    mocks.session.mockResolvedValue({ userId: "owner" });
    const response = await POST(new Request("http://localhost/api/v1/qr", {
      method: "POST", body: JSON.stringify({ deviceId: "device-12345678", userId: "victim", kind: "wifi", content: "WIFI:T:WPA;S:home;P:private;;" }),
    }));
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "owner" }) });
  });
});
