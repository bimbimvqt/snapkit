import { cookies } from "next/headers";

const backendUrl = (
  process.env.BACKEND_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "http://localhost:3001"
).replace(/\/$/, "");

type ApiEnvelope<T> = { data: T } | { error: { code: string; message: string } };

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

export async function backendFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const requestCookies = (await cookies()).toString();
  const headers = new Headers(init.headers);

  if (requestCookies) headers.set("cookie", requestCookies);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers,
  });
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || !body || !("data" in body)) {
    const error = body && "error" in body ? body.error : null;
    throw new BackendError(
      error?.message ?? "Backend không phản hồi hợp lệ",
      response.status,
      error?.code ?? "BACKEND_ERROR",
    );
  }

  return body.data;
}

export type AdminSessionUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: "USER" | "ADMIN";
};

export type Overview = {
  users: number;
  activeSubscriptions: number;
  qrCreated: number;
  cleanups: number;
  bytesFreed: number;
  events: Array<{ name: string; count: number }>;
};

export type AdminUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: "USER" | "ADMIN";
  disabled: boolean;
  createdAt: string;
  _count: { qrCodes: number; cleanups: number };
};

export type QrAnalytics = {
  totalCreated: number;
  totalScanned: number;
  latest: Array<{ id: string; kind: string; content: string; createdAt: string }>;
};

export type FeatureFlag = {
  key: string;
  description: string | null;
  enabled: boolean;
  rollout: number;
  updatedAt: string;
};

export type AdminConfig = {
  flags: FeatureFlag[];
  mobileConfig: unknown;
};

export type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  actor: { email: string | null } | null;
};
