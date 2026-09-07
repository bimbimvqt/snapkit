import { afterEach, describe, expect, it, vi } from "vitest";
import { BackendError, clientBackendFetch, readApiResponse } from "./api-response";

afterEach(() => vi.unstubAllGlobals());

describe("API response handling", () => {
  it.each([false, 0, "", { enabled: false }, []])("accepts a valid data envelope containing %j", async (data) => {
    await expect(readApiResponse(Response.json({ data }))).resolves.toEqual(data);
  });

  it.each([null, false, 12, "gateway unavailable", [], {}, { data: null }, { error: "invalid" }])("rejects malformed envelope %j with a typed error", async (body) => {
    await expect(readApiResponse(Response.json(body))).rejects.toBeInstanceOf(BackendError);
  });

  it("preserves API validation errors and status", async () => {
    await expect(readApiResponse(Response.json({ error: { message: "Giá không hợp lệ", code: "VALIDATION_ERROR" } }, { status: 400 })))
      .rejects.toMatchObject({ message: "Giá không hợp lệ", code: "VALIDATION_ERROR", status: 400 });
  });

  it("explains an expired session when a proxy returns a non-JSON 401", async () => {
    await expect(readApiResponse(new Response("Unauthorized", { status: 401 })))
      .rejects.toMatchObject({ status: 401, message: expect.stringContaining("đăng nhập lại") });
  });

  it("rejects an HTTP failure even when the envelope contains data", async () => {
    await expect(readApiResponse(Response.json({ data: {} }, { status: 500 })))
      .rejects.toMatchObject({ status: 500 });
  });
});

describe("client backend requests", () => {
  it("uses the same-origin backend proxy and bounds request time", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: { saved: true } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(clientBackendFetch("/api/admin/config", { method: "PATCH", body: JSON.stringify({ enabled: true }) })).resolves.toEqual({ saved: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/backend/api/admin/config");
    expect(init.method).toBe("PATCH");
    expect(init.headers.get("content-type")).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("preserves caller cancellation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ data: true }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await clientBackendFetch("/api/test", { signal: controller.signal });
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("turns a transport failure into a recoverable Vietnamese message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(clientBackendFetch("/api/test")).rejects.toMatchObject({ status: 503, code: "BACKEND_UNAVAILABLE" });
  });

  it("distinguishes a request timeout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timeout", "TimeoutError")));
    await expect(clientBackendFetch("/api/test")).rejects.toMatchObject({ status: 504, code: "BACKEND_TIMEOUT" });
  });
});
