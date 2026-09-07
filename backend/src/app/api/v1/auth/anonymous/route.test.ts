import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUser: vi.fn(), createUser: vi.fn(), getSession: vi.fn(), sign: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: mocks.findUser, create: mocks.createUser } } }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession, signAccessToken: mocks.sign, createRefreshToken: mocks.refresh }));
import { POST } from "./route";

const guest = { id: "guest-1", role: "USER", disabled: false, email: null, googleSubject: null, passwordHash: null };
function request() {
  return new Request("http://localhost/api/v1/auth/anonymous", {
    method: "POST", body: JSON.stringify({ deviceId: "123e4567-e89b-42d3-a456-426614174000" }),
  });
}

describe("anonymous identity ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findUser.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue(guest);
    mocks.getSession.mockResolvedValue(null);
    mocks.sign.mockResolvedValue("access");
    mocks.refresh.mockResolvedValue("refresh");
  });

  it("creates a new guest identity", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data.accessToken).toBe("access");
  });

  it("does not use a known device ID as a password for an existing guest", async () => {
    mocks.findUser.mockResolvedValue(guest);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([
    { email: "owner@example.com" }, { googleSubject: "google-subject" },
    { passwordHash: "hashed" }, { role: "ADMIN" }, { disabled: true },
  ])("does not issue anonymous credentials for linked, privileged or disabled users: %j", async (overrides) => {
    mocks.findUser.mockResolvedValue({ ...guest, ...overrides });
    mocks.getSession.mockResolvedValue({ userId: guest.id });
    const response = await POST(request());
    expect([401, 403]).toContain(response.status);
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("lets an authenticated guest continue only their own identity", async () => {
    mocks.findUser.mockResolvedValue(guest);
    mocks.getSession.mockResolvedValue({ userId: guest.id });
    expect((await POST(request())).status).toBe(200);
    mocks.getSession.mockResolvedValue({ userId: "different-user" });
    expect((await POST(request())).status).toBe(401);
  });
});
