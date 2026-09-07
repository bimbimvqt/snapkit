import { db } from "@/lib/db";
import { removeStoredPreview } from "@/lib/media-storage";

export const pendingUploadGraceMs = 10 * 60_000;

export async function cleanupExpiredMedia(options: { userId?: string; limit?: number } = {}) {
  const now = new Date();
  const pendingCutoff = new Date(now.getTime() - pendingUploadGraceMs);
  const limit = Math.min(500, Math.max(1, options.limit ?? 100));
  const candidates = await db.mediaScanAsset.findMany({
    where: {
      ...(options.userId ? { scan: { userId: options.userId } } : {}),
      OR: [
        { previewExpiresAt: { lte: now }, previewStorageKey: { not: null } },
        { originalExpiresAt: { lte: now }, originalStorageKey: { not: null } },
        { pendingExpiresAt: { lte: pendingCutoff }, pendingStorageKey: { not: null } },
      ],
    },
    take: limit,
    select: {
      previewStorageKey: true,
      originalStorageKey: true,
      pendingStorageKey: true,
      previewExpiresAt: true,
      originalExpiresAt: true,
      pendingExpiresAt: true,
    },
  });

  const storageKeys = new Set(candidates.flatMap((asset) => [
    asset.previewStorageKey && asset.previewExpiresAt && asset.previewExpiresAt <= now ? asset.previewStorageKey : null,
    asset.originalStorageKey && asset.originalExpiresAt && asset.originalExpiresAt <= now ? asset.originalStorageKey : null,
    asset.pendingStorageKey && asset.pendingExpiresAt && asset.pendingExpiresAt <= pendingCutoff ? asset.pendingStorageKey : null,
  ].filter((key): key is string => key !== null)));

  let deletedObjects = 0;
  for (const storageKey of storageKeys) {
    // A key can be shared by repeated scans or by a pending replacement and its
    // already-published preview. Check every reference before deleting bytes.
    const activeReferences = await db.mediaScanAsset.count({
      where: {
        OR: [
          { previewStorageKey: storageKey, OR: [{ previewExpiresAt: null }, { previewExpiresAt: { gt: now } }] },
          { originalStorageKey: storageKey, OR: [{ originalExpiresAt: null }, { originalExpiresAt: { gt: now } }] },
          { pendingStorageKey: storageKey, OR: [{ pendingExpiresAt: null }, { pendingExpiresAt: { gt: pendingCutoff } }] },
        ],
      },
    });
    if (activeReferences === 0) {
      await removeStoredPreview(storageKey);
      deletedObjects += 1;
    }
    await db.mediaScanAsset.updateMany({
      where: { previewStorageKey: storageKey, previewExpiresAt: { lte: now } },
      data: { previewStorageKey: null, previewMimeType: null, previewBytes: null, previewExpiresAt: null },
    });
    await db.mediaScanAsset.updateMany({
      where: { originalStorageKey: storageKey, originalExpiresAt: { lte: now } },
      data: { originalStorageKey: null, originalMimeType: null, originalBytes: null, originalExpiresAt: null },
    });
    await db.mediaScanAsset.updateMany({
      where: { pendingStorageKey: storageKey, pendingExpiresAt: { lte: pendingCutoff } },
      data: { pendingStorageKey: null, pendingMimeType: null, pendingBytes: null, pendingExpiresAt: null },
    });
  }

  return { deletedObjects };
}
