export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isRecord(body) && "data" in body && body.data !== null && body.data !== undefined) {
    return body.data as T;
  }

  const error = isRecord(body) && isRecord(body.error) ? body.error : null;
  const fallback = response.status === 401
    ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
    : response.status === 403
      ? "Tài khoản không có quyền thực hiện thao tác này."
      : "Máy chủ không phản hồi hợp lệ. Vui lòng thử lại.";
  throw new BackendError(
    typeof error?.message === "string" && error.message ? error.message : fallback,
    response.status,
    typeof error?.code === "string" ? error.code : "BACKEND_ERROR",
  );
}

export async function clientBackendFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  try {
    const response = await fetch(`/backend${path}`, {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
    return await readApiResponse<T>(response);
  } catch (error) {
    if (error instanceof BackendError) throw error;
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new BackendError("Máy chủ phản hồi quá lâu. Vui lòng thử lại.", 504, "BACKEND_TIMEOUT");
    }
    throw new BackendError("Không thể kết nối máy chủ. Vui lòng thử lại.", 503, "BACKEND_UNAVAILABLE");
  }
}
