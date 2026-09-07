import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackendError } from "@/lib/api-response";
import { backendFetch } from "@/lib/backend";
import { redirect } from "next/navigation";
import AdminLayout from "./layout";

vi.mock("@/lib/backend", async () => {
  const { BackendError } = await import("@/lib/api-response");
  return { BackendError, backendFetch: vi.fn() };
});
vi.mock("@/components/admin/app-shell", () => ({ AppShell: () => null }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("LOGIN_REDIRECT"); }) }));

beforeEach(() => vi.clearAllMocks());

describe("admin access and outage recovery", () => {
  it.each([401, 403])("redirects an auth failure (%s) to login", async (status) => {
    vi.mocked(backendFetch).mockRejectedValue(new BackendError("Session invalid", status, "AUTH_ERROR"));
    await expect(AdminLayout({ children: null })).rejects.toThrow("LOGIN_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it.each([500, 503, 504])("keeps an outage (%s) available to the recoverable error boundary", async (status) => {
    const outage = new BackendError("Service unavailable", status, "BACKEND_ERROR");
    vi.mocked(backendFetch).mockRejectedValue(outage);
    await expect(AdminLayout({ children: null })).rejects.toBe(outage);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("does not misclassify unexpected errors as a logout", async () => {
    const error = new TypeError("Invalid session response");
    vi.mocked(backendFetch).mockRejectedValue(error);
    await expect(AdminLayout({ children: null })).rejects.toBe(error);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("rejects regular user access", async () => {
    vi.mocked(backendFetch).mockResolvedValue({ role: "USER" });
    await expect(AdminLayout({ children: null })).rejects.toThrow("LOGIN_REDIRECT");
  });

  it("renders the admin shell for admins", async () => {
    vi.mocked(backendFetch).mockResolvedValue({ role: "ADMIN", email: "admin@example.test" });
    const shell = await AdminLayout({ children: "Dashboard" });
    expect(shell.props.email).toBe("admin@example.test");
    expect(shell.props.children).toBe("Dashboard");
    expect(redirect).not.toHaveBeenCalled();
  });
});
