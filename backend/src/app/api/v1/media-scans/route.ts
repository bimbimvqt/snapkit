import { createHash } from "node:crypto";
import { MediaAssetCategory, MediaAssetType } from "@prisma/client";
import { z } from "zod";
import { apiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const maximumThumbnailBytes = 96 * 1024;

const assetSchema = z.object({
  assetId: z.string().min(1).max(512),
  type: z.enum(MediaAssetType),
  categories: z.array(z.enum(MediaAssetCategory)).min(1).max(4),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  durationSeconds: z.number().int().nonnegative().optional(),
  capturedAt: z.iso.datetime().optional(),
  thumbnailBase64: z.base64().max(140_000).optional(),
});

export const mediaScanBatchSchema = z.object({
  clientScanId: z.uuid(),
  deviceId: z.string().min(8).max(80),
  scannedCount: z.number().int().min(0).max(5000),
  imageCount: z.number().int().min(0).max(5000),
  videoCount: z.number().int().min(0).max(5000),
  duplicateCount: z.number().int().min(0).max(5000),
  screenshotCount: z.number().int().min(0).max(5000),
  largeVideoCount: z.number().int().min(0).max(5000),
  durationMs: z.number().int().nonnegative(),
  maxScanAssets: z.number().int().min(50).max(5000),
  similarImageLimit: z.number().int().min(20).max(2000),
  largeVideoThresholdMb: z.number().int().min(10).max(4096),
  assets: z.array(assetSchema).max(20),
});

export async function POST(request: Request) {
  try {
    const input = mediaScanBatchSchema.parse(await request.json());
    const session = await getSession();
    if (!session) return fail("Vui lòng đăng nhập để đồng bộ lượt quét", 401, "UNAUTHORIZED");
    const parsedAssets = input.assets.map((asset) => {
      const thumbnail = asset.thumbnailBase64 ? Buffer.from(asset.thumbnailBase64, "base64") : undefined;
      if (thumbnail && thumbnail.byteLength > maximumThumbnailBytes) {
        throw new Error("THUMBNAIL_TOO_LARGE");
      }
      return {
        clientAssetId: asset.assetId,
        deviceAssetKey: createHash("sha256").update(asset.assetId).digest("hex"),
        type: asset.type,
        categories: asset.categories,
        bytes: BigInt(asset.bytes),
        width: asset.width,
        height: asset.height,
        durationSeconds: asset.durationSeconds,
        capturedAt: asset.capturedAt ? new Date(asset.capturedAt) : undefined,
        thumbnail,
        thumbnailMimeType: thumbnail ? "image/jpeg" : undefined,
      };
    });

    const scan = await db.mediaScan.upsert({
      where: { deviceId_clientScanId: { deviceId: input.deviceId, clientScanId: input.clientScanId } },
      update: {
        scannedCount: input.scannedCount,
        imageCount: input.imageCount,
        videoCount: input.videoCount,
        duplicateCount: input.duplicateCount,
        screenshotCount: input.screenshotCount,
        largeVideoCount: input.largeVideoCount,
        durationMs: input.durationMs,
        maxScanAssets: input.maxScanAssets,
        similarImageLimit: input.similarImageLimit,
        largeVideoThresholdMb: input.largeVideoThresholdMb,
      },
      create: {
        clientScanId: input.clientScanId,
        deviceId: input.deviceId,
        userId: session.userId,
        scannedCount: input.scannedCount,
        imageCount: input.imageCount,
        videoCount: input.videoCount,
        duplicateCount: input.duplicateCount,
        screenshotCount: input.screenshotCount,
        largeVideoCount: input.largeVideoCount,
        durationMs: input.durationMs,
        maxScanAssets: input.maxScanAssets,
        similarImageLimit: input.similarImageLimit,
        largeVideoThresholdMb: input.largeVideoThresholdMb,
      },
    });

    if (parsedAssets.length > 0) {
      await db.mediaScanAsset.createMany({
        data: parsedAssets.map((asset) => ({
          scanId: scan.id,
          deviceAssetKey: asset.deviceAssetKey,
          type: asset.type,
          categories: asset.categories,
          bytes: asset.bytes,
          width: asset.width,
          height: asset.height,
          durationSeconds: asset.durationSeconds,
          capturedAt: asset.capturedAt,
          thumbnail: asset.thumbnail,
          thumbnailMimeType: asset.thumbnailMimeType,
        })),
        skipDuplicates: true,
      });
    }

    const storedAssets = parsedAssets.length === 0
      ? []
      : await db.mediaScanAsset.findMany({
          where: { scanId: scan.id, deviceAssetKey: { in: parsedAssets.map((asset) => asset.deviceAssetKey) } },
          select: { id: true, deviceAssetKey: true, previewStorageKey: true },
        });
    const storedByKey = new Map(storedAssets.map((asset) => [asset.deviceAssetKey, asset]));

    return ok({
      id: scan.id,
      accepted: parsedAssets.length,
      assets: parsedAssets.flatMap((asset) => {
        const stored = storedByKey.get(asset.deviceAssetKey);
        return stored
          ? [{ assetId: asset.clientAssetId, id: stored.id, hasPreview: stored.previewStorageKey !== null }]
          : [];
      }),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "THUMBNAIL_TOO_LARGE") {
      return fail("Thumbnail vượt quá dung lượng cho phép", 413, "THUMBNAIL_TOO_LARGE");
    }
    return apiError(error);
  }
}
