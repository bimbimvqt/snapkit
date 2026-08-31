import type { MediaScanAnalytics, MediaScanAsset, MediaScanGroup } from "@/lib/backend";

type UnknownRecord = Record<string, unknown>;
type MediaType = "ALL" | "IMAGE" | "VIDEO";

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown) {
  return typeof value === "string" ? value : null;
}

function mediaType(value: unknown): MediaType {
  return value === "IMAGE" || value === "VIDEO" ? value : "ALL";
}

function legacyAsset(value: unknown, createdAt: string): MediaScanAsset | null {
  const asset = record(value);
  if (typeof asset.id !== "string" || (asset.type !== "IMAGE" && asset.type !== "VIDEO")) return null;
  const categories = Array.isArray(asset.categories)
    ? asset.categories.filter((category): category is MediaScanAsset["categories"][number] =>
        category === "SIMILAR" || category === "SCREENSHOT" || category === "LARGE_VIDEO" || category === "OTHER")
    : [];
  return {
    id: asset.id,
    type: asset.type,
    categories,
    bytes: number(asset.bytes),
    width: number(asset.width),
    height: number(asset.height),
    durationSeconds: typeof asset.durationSeconds === "number" ? asset.durationSeconds : null,
    capturedAt: nullableText(asset.capturedAt),
    createdAt,
    hasThumbnail: asset.hasThumbnail === true,
    hasPreview: false,
    hasOriginal: false,
    previewMimeType: null,
  };
}

export function normalizeMediaScanAnalytics(
  input: unknown,
  options: { group?: string; page?: number; pageSize?: number; type?: string } = {},
): MediaScanAnalytics {
  const source = record(input);
  if (Array.isArray(source.groups) && record(source.assets).items !== undefined) {
    return source as unknown as MediaScanAnalytics;
  }

  const scans = Array.isArray(source.latest) ? source.latest.map(record) : [];
  const grouped = new Map<string, { group: MediaScanGroup; assets: MediaScanAsset[] }>();
  for (const scan of scans) {
    const user = record(scan.user);
    const email = nullableText(user.email);
    const name = nullableText(user.name);
    const deviceId = text(scan.deviceId, "không xác định");
    const key = email ? `legacy-user:${email}` : `legacy-device:${deviceId}`;
    const createdAt = text(scan.createdAt, new Date(0).toISOString());
    const assets = Array.isArray(scan.assets)
      ? scan.assets.flatMap((asset) => {
          const parsed = legacyAsset(asset, createdAt);
          return parsed ? [parsed] : [];
        })
      : [];
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        group: {
          key,
          user: email || name ? { id: email ?? name ?? key, email, name } : null,
          deviceId: email || name ? null : deviceId,
          scanCount: 1,
          deviceCount: 1,
          assetCount: assets.length,
          imageCount: assets.filter((asset) => asset.type === "IMAGE").length,
          videoCount: assets.filter((asset) => asset.type === "VIDEO").length,
          latestScanAt: createdAt,
        },
        assets,
      });
      continue;
    }
    current.group.scanCount += 1;
    current.group.assetCount += assets.length;
    current.group.imageCount += assets.filter((asset) => asset.type === "IMAGE").length;
    current.group.videoCount += assets.filter((asset) => asset.type === "VIDEO").length;
    current.assets.push(...assets);
  }

  const groups = [...grouped.values()].map((item) => item.group);
  const selectedGroupKey = options.group && grouped.has(options.group) ? options.group : groups[0]?.key ?? null;
  const type = mediaType(options.type);
  const selectedAssets = selectedGroupKey ? grouped.get(selectedGroupKey)?.assets ?? [] : [];
  const uniqueAssets = [...new Map(selectedAssets.map((asset) => [asset.id, asset])).values()]
    .filter((asset) => type === "ALL" || asset.type === type);
  const requestedPageSize = typeof options.pageSize === "number" && Number.isFinite(options.pageSize) ? options.pageSize : 24;
  const requestedPage = typeof options.page === "number" && Number.isFinite(options.page) ? options.page : 1;
  const pageSize = Math.min(60, Math.max(12, Math.trunc(requestedPageSize)));
  const totalPages = Math.max(1, Math.ceil(uniqueAssets.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Math.trunc(requestedPage)));
  const offset = (page - 1) * pageSize;

  return {
    totalScans: number(source.totalScans),
    totalAssets: number(source.totalAssets),
    duplicateAssets: number(source.duplicateAssets),
    groups,
    selectedGroupKey,
    assets: {
      items: uniqueAssets.slice(offset, offset + pageSize),
      page,
      pageSize,
      total: uniqueAssets.length,
      totalPages,
      type,
    },
  };
}
