import { apiError, fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { removeStoredPreview } from "@/lib/media-storage";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return fail("Không có quyền truy cập", 403, "FORBIDDEN");
    const { id } = await context.params;
    const asset = await db.mediaScanAsset.findUnique({
      where: { id },
      select: {
        id: true,
        deviceAssetKey: true,
        type: true,
        scan: { select: { deviceId: true } },
      },
    });
    if (!asset) return fail("Media không còn tồn tại", 404, "NOT_FOUND");

    const matches = await db.mediaScanAsset.findMany({
      where: { deviceAssetKey: asset.deviceAssetKey, scan: { deviceId: asset.scan.deviceId } },
      select: { id: true, previewStorageKey: true, previewBytes: true },
    });
    await db.$transaction(async (transaction) => {
      await transaction.mediaScanAsset.deleteMany({ where: { id: { in: matches.map((item) => item.id) } } });
      await transaction.auditLog.create({
        data: {
          actorId: admin.userId,
          action: "media_scan_asset.delete",
          entity: "MediaScanAsset",
          entityId: id,
          before: {
            type: asset.type,
            repeatedRecords: matches.length,
            previewBytes: matches.reduce((sum, item) => sum + Number(item.previewBytes ?? 0), 0),
          },
          after: { deleted: true },
        },
      });
    });
    await Promise.all(matches.map((item) => removeStoredPreview(item.previewStorageKey)));
    return ok({ id, deletedRecords: matches.length });
  } catch (error) {
    return apiError(error);
  }
}
