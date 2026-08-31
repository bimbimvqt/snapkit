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
  apiVersion: "legacy" | "analytics_v2";
  period: { days: number; start: string; end: string };
  audience: {
    totalUsers: number;
    newUsers: number;
    previousNewUsers: number;
    newUsersChange: number | null;
    activeUsers: number;
    activeSubscriptions: number;
    proConversion: number;
  };
  engagement: {
    totalEvents: number;
    previousEvents: number;
    eventsChange: number | null;
    events: Array<{ name: string; count: number }>;
    platforms: Array<{ name: string; count: number }>;
  };
  productivity: {
    qrCreated: number;
    previousQrCreated: number;
    qrChange: number | null;
    cleanups: number;
    previousCleanups: number;
    cleanupChange: number | null;
    scannedForCleanup: number;
    removedItems: number;
    bytesFreed: number;
  };
  media: {
    scans: number;
    scannedAssets: number;
    images: number;
    videos: number;
    duplicates: number;
    screenshots: number;
    largeVideos: number;
    averageScanSeconds: number;
    totalPreviewAssets: number;
    previewReadyAssets: number;
    previewCoverage: number;
  };
  storage: {
    sourceHost?: string;
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
    databaseBytes: number;
    previewBytes: number;
  } | null;
  trend: Array<{
    date: string;
    events: number;
    newUsers: number;
    qrCreated: number;
    cleanups: number;
    mediaScans: number;
  }>;
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
  latest: Array<{ id: string; kind: string; content: string; style: unknown; createdAt: string }>;
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

export type SubscriptionPlan = {
  id: string;
  productId: string;
  name: string;
  badge: string;
  price: number;
  currency: string;
  priceLabel: string;
  periodLabel: string;
  trialDays: number;
  ctaLabel: string;
  description: string;
  features: string[];
  benefits: string[];
  highlighted: boolean;
  enabled: boolean;
  sortOrder: number;
};

export type SubscriptionPlanConfig = {
  title: string;
  subtitle: string;
  footer: string;
  plans: SubscriptionPlan[];
};

export type AdminSubscriptionPlans = {
  config: SubscriptionPlanConfig;
  updatedAt: string | null;
};

export type MediaScanAsset = {
  id: string;
  type: "IMAGE" | "VIDEO";
  categories: Array<"SIMILAR" | "SCREENSHOT" | "LARGE_VIDEO" | "OTHER">;
  bytes: number;
  width: number;
  height: number;
  durationSeconds: number | null;
  capturedAt: string | null;
  createdAt: string;
  hasThumbnail: boolean;
  hasPreview: boolean;
  previewMimeType: string | null;
};

export type MediaScanGroup = {
  key: string;
  user: { id: string; email: string | null; name: string | null } | null;
  deviceId: string | null;
  scanCount: number;
  deviceCount: number;
  assetCount: number;
  imageCount: number;
  videoCount: number;
  latestScanAt: string;
};

export type MediaScanAnalytics = {
  totalScans: number;
  totalAssets: number;
  duplicateAssets: number;
  groups: MediaScanGroup[];
  selectedGroupKey: string | null;
  assets: {
    items: MediaScanAsset[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    type: "ALL" | "IMAGE" | "VIDEO";
  };
};

export type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
  actor: { email: string | null } | null;
};
