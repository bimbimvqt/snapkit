import { apiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  browserVideoStorageKeyFor,
  imagePreviewMimeTypes,
  maximumPreviewBytes,
  originalStorageKeyFor,
  removeStoredPreview,
  storageKeyFor,
  storePreview,
  transcodeBrowserVideo,
  videoPreviewMimeTypes,
} from "@/lib/media-storage";
import { cleanupExpiredMedia } from "@/lib/media-retention";
import { mediaStorageEntitlement, retentionDate, userMediaStorageBytes } from "@/lib/media-subscription";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Vui lòng đăng nhập để đồng bộ preview", 401, "UNAUTHORIZED");
    const { id } = await context.params;
    const asset = await db.mediaScanAsset.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        previewStorageKey: true,
        previewBytes: true,
        originalStorageKey: true,
        originalBytes: true,
        scan: { select: { userId: true } },
      },
    });
    if (!asset || asset.scan.userId !== session.userId) return fail("Không tìm thấy media", 404, "NOT_FOUND");
    if (!request.body) return fail("Preview rỗng", 422, "EMPTY_PREVIEW");

    const mimeType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    const allowed = asset.type === "IMAGE" ? imagePreviewMimeTypes : videoPreviewMimeTypes;
    if (!allowed.has(mimeType)) return fail("Định dạng preview không được hỗ trợ", 415, "UNSUPPORTED_MEDIA_TYPE");

    await cleanupExpiredMedia({ userId: session.userId, limit: 50 });
    const entitlement = await mediaStorageEntitlement(session.userId);
    const maximumBytes = asset.type === "VIDEO"
      ? entitlement.policy.maxVideoUploadMb * 1024 * 1024
      : maximumPreviewBytes();
    const contentLength = Number(request.headers.get("content-length"));
    if (!Number.isInteger(contentLength) || contentLength <= 0) {
      return fail("Thiếu kích thước preview", 411, "LENGTH_REQUIRED");
    }
    if (contentLength > maximumBytes) return fail("Preview vượt quá dung lượng cho phép", 413, "PREVIEW_TOO_LARGE");
    const usedBytes = await userMediaStorageBytes(session.userId);
    const replacingBytes = asset.type === "VIDEO"
      ? Number(asset.originalBytes ?? BigInt(0))
      : Number(asset.previewBytes ?? BigInt(0));
    const reservedBytes = contentLength * (
      asset.type === "VIDEO" && entitlement.policy.originalVideoRetentionDays > 0 ? 2 : 1
    );
    if (usedBytes - replacingBytes + reservedBytes > entitlement.policy.quotaMb * 1024 * 1024) {
      return fail("Dung lượng lưu trữ của gói đã đầy", 413, "STORAGE_QUOTA_EXCEEDED");
    }
    const previewExpiresAt = retentionDate(entitlement.policy.previewRetentionDays);

    if (asset.type === "IMAGE") {
      const storageKey = storageKeyFor(asset.id, mimeType);
      const storedBytes = await storePreview(storageKey, request.body, maximumBytes);
      await db.mediaScanAsset.update({
        where: { id: asset.id },
        data: {
          previewStorageKey: storageKey,
          previewMimeType: mimeType,
          previewBytes: BigInt(storedBytes),
          previewExpiresAt,
        },
      });
      if (asset.previewStorageKey !== storageKey) await removeStoredPreview(asset.previewStorageKey);
      return ok({ id: asset.id, bytes: storedBytes, mimeType });
    }

    const originalStorageKey = originalStorageKeyFor(asset.id, mimeType);
    const originalBytes = await storePreview(originalStorageKey, request.body, maximumBytes);
    await db.mediaScanAsset.update({
      where: { id: asset.id },
      data: {
        originalStorageKey,
        originalMimeType: mimeType,
        originalBytes: BigInt(originalBytes),
        originalExpiresAt: entitlement.policy.originalVideoRetentionDays > 0
          ? retentionDate(entitlement.policy.originalVideoRetentionDays)
          : null,
      },
    });
    if (asset.originalStorageKey !== originalStorageKey) await removeStoredPreview(asset.originalStorageKey);

    const previewStorageKey = browserVideoStorageKeyFor(asset.id);
    const previewBytes = await transcodeBrowserVideo(originalStorageKey, previewStorageKey);
    await db.mediaScanAsset.update({
      where: { id: asset.id },
      data: {
        previewStorageKey,
        previewMimeType: "video/mp4",
        previewBytes: BigInt(previewBytes),
        previewExpiresAt,
      },
    });
    if (asset.previewStorageKey !== previewStorageKey && asset.previewStorageKey !== originalStorageKey) {
      await removeStoredPreview(asset.previewStorageKey);
    }
    if (entitlement.policy.originalVideoRetentionDays === 0) {
      await removeStoredPreview(originalStorageKey);
      await db.mediaScanAsset.update({
        where: { id: asset.id },
        data: {
          originalStorageKey: null,
          originalMimeType: null,
          originalBytes: null,
          originalExpiresAt: null,
        },
      });
    }
    return ok({
      id: asset.id,
      bytes: originalBytes,
      mimeType,
      previewBytes,
      previewMimeType: "video/mp4",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PREVIEW_TOO_LARGE") {
      return fail("Preview vượt quá dung lượng cho phép", 413, "PREVIEW_TOO_LARGE");
    }
    if (error instanceof Error && error.message === "EMPTY_PREVIEW") {
      return fail("Preview rỗng", 422, "EMPTY_PREVIEW");
    }
    return apiError(error);
  }
}
