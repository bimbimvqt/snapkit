import { apiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeStoredPreview, transcodeBrowserVideo } from "@/lib/media-storage";
import { mediaStorageEntitlement, retentionDate } from "@/lib/media-subscription";
import { headR2Object, mediaR2Reference, r2Configured } from "@/lib/r2-storage";

export const runtime = "nodejs";

const pendingGraceMs = 10 * 60_000;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Vui lòng đăng nhập để hoàn tất media", 401, "UNAUTHORIZED");
    if (!r2Configured()) return fail("Cloudflare R2 chưa được cấu hình", 503, "R2_NOT_CONFIGURED");
    const { id } = await context.params;
    const asset = await db.mediaScanAsset.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        previewStorageKey: true,
        originalStorageKey: true,
        pendingStorageKey: true,
        pendingMimeType: true,
        pendingBytes: true,
        pendingExpiresAt: true,
        scan: { select: { userId: true } },
      },
    });
    if (!asset || asset.scan.userId !== session.userId) return fail("Không tìm thấy media", 404, "NOT_FOUND");
    if (!asset.pendingStorageKey || !asset.pendingMimeType || !asset.pendingBytes || !asset.pendingExpiresAt) {
      return fail("Không có lượt upload đang chờ", 409, "UPLOAD_NOT_PENDING");
    }
    if (asset.pendingExpiresAt.getTime() + pendingGraceMs < Date.now()) {
      return fail("Lượt upload đã hết hạn", 410, "UPLOAD_EXPIRED");
    }

    const stored = await headR2Object(asset.pendingStorageKey).catch(() => null);
    const expectedBytes = Number(asset.pendingBytes);
    if (!stored || stored.size !== expectedBytes || stored.mimeType !== asset.pendingMimeType) {
      return fail("File tải lên chưa hoàn tất hoặc không hợp lệ", 409, "UPLOAD_INCOMPLETE");
    }

    const entitlement = await mediaStorageEntitlement(session.userId);
    const previewExpiresAt = retentionDate(entitlement.policy.previewRetentionDays);
    if (asset.type === "IMAGE") {
      await db.mediaScanAsset.update({
        where: { id: asset.id },
        data: {
          previewStorageKey: asset.pendingStorageKey,
          previewMimeType: asset.pendingMimeType,
          previewBytes: asset.pendingBytes,
          previewExpiresAt,
          pendingStorageKey: null,
          pendingMimeType: null,
          pendingBytes: null,
          pendingExpiresAt: null,
        },
      });
      if (asset.previewStorageKey !== asset.pendingStorageKey) {
        await removeStoredPreview(asset.previewStorageKey).catch(() => undefined);
      }
      return ok({ id: asset.id, bytes: expectedBytes, mimeType: asset.pendingMimeType, planId: entitlement.planId });
    }

    const retainOriginal = entitlement.policy.originalVideoRetentionDays > 0;
    const previewStorageKey = mediaR2Reference(session.userId, asset.id, "preview", "mp4");
    const previewBytes = await transcodeBrowserVideo(asset.pendingStorageKey, previewStorageKey);
    await db.mediaScanAsset.update({
      where: { id: asset.id },
      data: {
        previewStorageKey,
        previewMimeType: "video/mp4",
        previewBytes: BigInt(previewBytes),
        previewExpiresAt,
        originalStorageKey: retainOriginal ? asset.pendingStorageKey : null,
        originalMimeType: retainOriginal ? asset.pendingMimeType : null,
        originalBytes: retainOriginal ? asset.pendingBytes : null,
        originalExpiresAt: retainOriginal
          ? retentionDate(entitlement.policy.originalVideoRetentionDays)
          : null,
        pendingStorageKey: null,
        pendingMimeType: null,
        pendingBytes: null,
        pendingExpiresAt: null,
      },
    });

    await Promise.allSettled([
      asset.previewStorageKey !== previewStorageKey && asset.previewStorageKey !== asset.pendingStorageKey
        ? removeStoredPreview(asset.previewStorageKey)
        : Promise.resolve(),
      asset.originalStorageKey !== asset.pendingStorageKey
        ? removeStoredPreview(asset.originalStorageKey)
        : Promise.resolve(),
      !retainOriginal ? removeStoredPreview(asset.pendingStorageKey) : Promise.resolve(),
    ]);

    return ok({
      id: asset.id,
      bytes: expectedBytes,
      mimeType: asset.pendingMimeType,
      previewBytes,
      previewMimeType: "video/mp4",
      originalRetained: retainOriginal,
      planId: entitlement.planId,
    });
  } catch (error) {
    return apiError(error);
  }
}
