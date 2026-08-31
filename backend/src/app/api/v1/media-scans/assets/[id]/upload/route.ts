import { z } from "zod";
import { apiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  extensionForMimeType,
  imagePreviewMimeTypes,
  maximumPreviewBytes,
  videoPreviewMimeTypes,
} from "@/lib/media-storage";
import { mediaStorageEntitlement, userMediaStorageBytes } from "@/lib/media-subscription";
import { cleanupExpiredMedia } from "@/lib/media-retention";
import { createR2Upload, mediaR2Reference, r2Configured } from "@/lib/r2-storage";

export const runtime = "nodejs";

const uploadSchema = z.object({
  mimeType: z.string().trim().toLowerCase(),
  bytes: z.number().int().positive(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Vui lòng đăng nhập để tải media lên", 401, "UNAUTHORIZED");
    const input = uploadSchema.parse(await request.json());
    const { id } = await context.params;
    const asset = await db.mediaScanAsset.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        pendingBytes: true,
        previewBytes: true,
        originalBytes: true,
        scan: { select: { userId: true } },
      },
    });
    if (!asset || asset.scan.userId !== session.userId) return fail("Không tìm thấy media", 404, "NOT_FOUND");

    const allowedMimeTypes = asset.type === "IMAGE" ? imagePreviewMimeTypes : videoPreviewMimeTypes;
    if (!allowedMimeTypes.has(input.mimeType)) {
      return fail("Định dạng media không được hỗ trợ", 415, "UNSUPPORTED_MEDIA_TYPE");
    }

    const entitlement = await mediaStorageEntitlement(session.userId);
    await cleanupExpiredMedia({ userId: session.userId, limit: 50 });
    const maximumBytes = asset.type === "VIDEO"
      ? entitlement.policy.maxVideoUploadMb * 1024 * 1024
      : maximumPreviewBytes();
    if (maximumBytes <= 0 || input.bytes > maximumBytes) {
      return fail("Media vượt quá giới hạn của gói hiện tại", 413, "PLAN_UPLOAD_LIMIT");
    }

    const usedBytes = await userMediaStorageBytes(session.userId);
    const quotaBytes = entitlement.policy.quotaMb * 1024 * 1024;
    const replacingBytes = Math.max(
      Number(asset.pendingBytes ?? BigInt(0)),
      Number(asset.type === "VIDEO" ? asset.originalBytes ?? BigInt(0) : asset.previewBytes ?? BigInt(0)),
    );
    const reservedBytes = input.bytes * (
      asset.type === "VIDEO" && entitlement.policy.originalVideoRetentionDays > 0 ? 2 : 1
    );
    if (usedBytes - replacingBytes + reservedBytes > quotaBytes) {
      return fail("Dung lượng lưu trữ của gói đã đầy", 413, "STORAGE_QUOTA_EXCEEDED");
    }

    if (!r2Configured()) {
      return ok({
        mode: "proxy",
        uploadUrl: `/api/v1/media-scans/assets/${asset.id}/preview`,
        headers: { "content-type": input.mimeType, "content-length": String(input.bytes) },
        plan: { id: entitlement.planId, quotaBytes, usedBytes, reservedBytes },
      });
    }

    const kind = asset.type === "VIDEO" ? "original" : "preview";
    const reference = mediaR2Reference(
      session.userId,
      asset.id,
      kind,
      extensionForMimeType(input.mimeType),
    );
    const upload = await createR2Upload(reference, input.mimeType, input.bytes);
    await db.mediaScanAsset.update({
      where: { id: asset.id },
      data: {
        pendingStorageKey: reference,
        pendingMimeType: input.mimeType,
        pendingBytes: BigInt(input.bytes),
        pendingExpiresAt: upload.expiresAt,
      },
    });
    return ok({
      mode: "direct",
      uploadUrl: upload.url,
      headers: upload.headers,
      expiresAt: upload.expiresAt,
      plan: { id: entitlement.planId, quotaBytes, usedBytes, reservedBytes },
    });
  } catch (error) {
    return apiError(error);
  }
}
