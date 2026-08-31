import { MediaAssetType, Prisma } from "@prisma/client";
import { z } from "zod";
import { apiError, fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const mediaScanAdminQuerySchema = z.object({
  group: z.string().trim().min(3).max(600).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(12).max(60).default(24),
  type: z.enum(["ALL", ...Object.values(MediaAssetType)]).default("ALL"),
});

type CountRow = { count: bigint };

type GroupRow = {
  key: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  anonymousDeviceId: string | null;
  scanCount: bigint;
  deviceCount: bigint;
  assetCount: bigint;
  imageCount: bigint;
  videoCount: bigint;
  latestScanAt: Date;
};

type AssetRow = {
  id: string;
  type: MediaAssetType;
  categories: string[];
  bytes: bigint;
  width: number;
  height: number;
  durationSeconds: number | null;
  capturedAt: Date | null;
  createdAt: Date;
  hasThumbnail: boolean;
  hasPreview: boolean;
  hasOriginal: boolean;
  previewMimeType: string | null;
};

function groupWhere(groupKey: string) {
  const separator = groupKey.indexOf(":");
  const kind = groupKey.slice(0, separator);
  const id = groupKey.slice(separator + 1);
  if (!id) throw new Error("INVALID_MEDIA_GROUP");
  if (kind === "user") return Prisma.sql`s."userId" = ${id}`;
  if (kind === "device") return Prisma.sql`s."userId" IS NULL AND s."deviceId" = ${id}`;
  throw new Error("INVALID_MEDIA_GROUP");
}

function assetTypeWhere(type: "ALL" | MediaAssetType) {
  return type === "ALL" ? Prisma.empty : Prisma.sql`AND a."type" = ${type}::"MediaAssetType"`;
}

function value(rows: CountRow[]) {
  return Number(rows[0]?.count ?? BigInt(0));
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");
    const query = mediaScanAdminQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const [totalScans, totalAssetsRows, duplicateAssetsRows, groupRows] = await Promise.all([
      db.mediaScan.count(),
      db.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM (
          SELECT
            CASE
              WHEN s."userId" IS NOT NULL THEN 'user:' || s."userId"
              ELSE 'device:' || s."deviceId"
            END AS owner,
            s."deviceId",
            a."deviceAssetKey"
          FROM "MediaScanAsset" a
          INNER JOIN "MediaScan" s ON s.id = a."scanId"
          GROUP BY 1, s."deviceId", a."deviceAssetKey"
        ) unique_assets
      `),
      db.$queryRaw<CountRow[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM (
          SELECT
            CASE
              WHEN s."userId" IS NOT NULL THEN 'user:' || s."userId"
              ELSE 'device:' || s."deviceId"
            END AS owner,
            s."deviceId",
            a."deviceAssetKey"
          FROM "MediaScanAsset" a
          INNER JOIN "MediaScan" s ON s.id = a."scanId"
          WHERE a.categories @> ARRAY['SIMILAR']::"MediaAssetCategory"[]
          GROUP BY 1, s."deviceId", a."deviceAssetKey"
        ) unique_duplicates
      `),
      db.$queryRaw<GroupRow[]>(Prisma.sql`
        WITH scan_owners AS (
          SELECT
            s.id,
            s."userId",
            s."deviceId",
            s."createdAt",
            CASE
              WHEN s."userId" IS NOT NULL THEN 'user:' || s."userId"
              ELSE 'device:' || s."deviceId"
            END AS key,
            CASE WHEN s."userId" IS NULL THEN s."deviceId" ELSE NULL END AS "anonymousDeviceId"
          FROM "MediaScan" s
        )
        SELECT
          s.key,
          s."userId",
          u.email,
          u.name,
          s."anonymousDeviceId",
          COUNT(DISTINCT s.id)::bigint AS "scanCount",
          COUNT(DISTINCT s."deviceId")::bigint AS "deviceCount",
          COUNT(DISTINCT (s."deviceId", a."deviceAssetKey"))::bigint AS "assetCount",
          COUNT(DISTINCT (s."deviceId", a."deviceAssetKey")) FILTER (WHERE a.type = 'IMAGE')::bigint AS "imageCount",
          COUNT(DISTINCT (s."deviceId", a."deviceAssetKey")) FILTER (WHERE a.type = 'VIDEO')::bigint AS "videoCount",
          MAX(s."createdAt") AS "latestScanAt"
        FROM scan_owners s
        LEFT JOIN "User" u ON u.id = s."userId"
        LEFT JOIN "MediaScanAsset" a ON a."scanId" = s.id
        GROUP BY s.key, s."userId", s."anonymousDeviceId", u.id, u.email, u.name
        ORDER BY "latestScanAt" DESC
      `),
    ]);

    const groups = groupRows.map((group) => ({
      key: group.key,
      user: group.userId ? { id: group.userId, email: group.email, name: group.name } : null,
      deviceId: group.anonymousDeviceId ? `${group.anonymousDeviceId.slice(0, 8)}…` : null,
      scanCount: Number(group.scanCount),
      deviceCount: Number(group.deviceCount),
      assetCount: Number(group.assetCount),
      imageCount: Number(group.imageCount),
      videoCount: Number(group.videoCount),
      latestScanAt: group.latestScanAt,
    }));
    const selectedGroup = groups.find((group) => group.key === query.group) ?? groups[0] ?? null;

    if (!selectedGroup) {
      return ok({
        totalScans,
        totalAssets: value(totalAssetsRows),
        duplicateAssets: value(duplicateAssetsRows),
        groups,
        selectedGroupKey: null,
        assets: { items: [], page: 1, pageSize: query.pageSize, total: 0, totalPages: 1, type: query.type },
      });
    }

    const ownerWhere = groupWhere(selectedGroup.key);
    const typeWhere = assetTypeWhere(query.type);
    const assetCountRows = await db.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(DISTINCT (s."deviceId", a."deviceAssetKey"))::bigint AS count
      FROM "MediaScanAsset" a
      INNER JOIN "MediaScan" s ON s.id = a."scanId"
      WHERE ${ownerWhere} ${typeWhere}
    `);
    const assetCount = value(assetCountRows);
    const totalPages = Math.max(1, Math.ceil(assetCount / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const offset = (page - 1) * query.pageSize;
    const assets = await db.$queryRaw<AssetRow[]>(Prisma.sql`
      WITH ranked_assets AS (
        SELECT
          a.id,
          a.type,
          a.categories,
          a.bytes,
          a.width,
          a.height,
          a."durationSeconds",
          a."capturedAt",
          a."createdAt",
          a.thumbnail IS NOT NULL AS "hasThumbnail",
          (
            a."previewStorageKey" IS NOT NULL
            OR (a.type = 'VIDEO' AND a."originalStorageKey" IS NOT NULL)
          ) AS "hasPreview",
          a."originalStorageKey" IS NOT NULL AS "hasOriginal",
          CASE
            WHEN a.type = 'VIDEO' AND a."originalStorageKey" IS NOT NULL THEN 'video/mp4'
            ELSE a."previewMimeType"
          END AS "previewMimeType",
          ROW_NUMBER() OVER (
            PARTITION BY s."deviceId", a."deviceAssetKey"
            ORDER BY a."createdAt" DESC, a.id DESC
          ) AS position
        FROM "MediaScanAsset" a
        INNER JOIN "MediaScan" s ON s.id = a."scanId"
        WHERE ${ownerWhere} ${typeWhere}
      )
      SELECT
        id,
        type,
        categories,
        bytes,
        width,
        height,
        "durationSeconds",
        "capturedAt",
        "createdAt",
        "hasThumbnail",
        "hasPreview",
        "hasOriginal",
        "previewMimeType"
      FROM ranked_assets
      WHERE position = 1
      ORDER BY COALESCE("capturedAt", "createdAt") DESC, id DESC
      LIMIT ${query.pageSize}
      OFFSET ${offset}
    `);

    return ok({
      totalScans,
      totalAssets: value(totalAssetsRows),
      duplicateAssets: value(duplicateAssetsRows),
      groups,
      selectedGroupKey: selectedGroup.key,
      assets: {
        items: assets.map(({ bytes, ...asset }) => ({ ...asset, bytes: Number(bytes) })),
        page,
        pageSize: query.pageSize,
        total: assetCount,
        totalPages,
        type: query.type,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_MEDIA_GROUP") {
      return fail("Nhóm media không hợp lệ", 422, "VALIDATION_ERROR");
    }
    return apiError(error);
  }
}
