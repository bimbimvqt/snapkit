import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(), verify: vi.fn(), find: vi.fn(), update: vi.fn(), create: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getSession: mocks.session, createRefreshToken: async () => "refresh",
  signAccessToken: async () => "access", setAuthCookies: vi.fn(),
}));
vi.mock("@/lib/google-auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/google-auth")>(), verifyGoogleIdToken: mocks.verify,
}));
vi.mock("@/lib/media-subscription", () => ({ mediaStorageEntitlement: async () => ({ isPro: false, planId: "free" }) }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction } }));
import { POST } from "./route";

const deviceId = "123e4567-e89b-42d3-a456-426614174000";
const guest = { id: "guest", role: "USER", disabled: false, email: null, googleSubject: null, passwordHash: null };
function request() {
  return new Request("http://localhost/api/v1/auth/google", {
    method: "POST", body: JSON.stringify({ idToken: "x".repeat(120), deviceId }),
  });
}

describe("Google anonymous account upgrade", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.verify.mockResolvedValue({ subject: "google-id", email: "new@example.com", name: "Owner", avatarUrl: null });
    mocks.find.mockImplementation(async ({ where }) => where.anonymousId ? guest : null);
    mocks.create.mockResolvedValue({ id: "new-user", role: "USER", email: "new@example.com", disabled: false });
    mocks.update.mockResolvedValue({ ...guest, email: "new@example.com" });
    mocks.transaction.mockImplementation(async (callback) => callback({
      user: { findUnique: mocks.find, create: mocks.create, update: mocks.update },
    }));
  });

  it("does not claim a device's anonymous account without a session", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.find).not.toHaveBeenCalledWith({ where: { anonymousId: deviceId } });
  });

  it("does not claim another guest's device ID using an unrelated session", async () => {
    mocks.session.mockResolvedValue({ userId: "other-user" });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledOnce();
  });

  it("preserves guest data when its authenticated owner upgrades with Google", async () => {
    mocks.session.mockResolvedValue({ userId: guest.id });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: guest.id },
      data: expect.objectContaining({ googleSubject: "google-id", email: "new@example.com" }),
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
