import { db } from "@/lib/db";
import { removeStoredPreview } from "@/lib/media-storage";

export async function cleanupExpiredMedia(options: { userId?: string; limit?: number } = {}) {
  const now = new Date();
  const limit = Math.min(500, Math.max(1, options.limit ?? 100));
  const candidates = await db.mediaScanAsset.findMany({
    where: {
      ...(options.userId ? { scan: { userId: options.userId } } : {}),
      OR: [
        { previewExpiresAt: { lte: now }, previewStorageKey: { not: null } },
        { originalExpiresAt: { lte: now }, originalStorageKey: { not: null } },
        { pendingExpiresAt: { lte: now }, pendingStorageKey: { not: null } },
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

  const previewKeys = new Set(
    candidates
      .filter((asset) => asset.previewStorageKey && asset.previewExpiresAt && asset.previewExpiresAt <= now)
      .map((asset) => asset.previewStorageKey as string),
  );
  const originalKeys = new Set(
    candidates
      .filter((asset) => asset.originalStorageKey && asset.originalExpiresAt && asset.originalExpiresAt <= now)
      .map((asset) => asset.originalStorageKey as string),
  );
  const pendingKeys = new Set(
    candidates
      .filter((asset) => asset.pendingStorageKey && asset.pendingExpiresAt && asset.pendingExpiresAt <= now)
      .map((asset) => asset.pendingStorageKey as string),
  );

  let deletedObjects = 0;
  for (const storageKey of previewKeys) {
    const activeReferences = await db.mediaScanAsset.count({
      where: {
        previewStorageKey: storageKey,
        OR: [{ previewExpiresAt: null }, { previewExpiresAt: { gt: now } }],
      },
    });
    if (activeReferences > 0) continue;
    await removeStoredPreview(storageKey);
    await db.mediaScanAsset.updateMany({
      where: { previewStorageKey: storageKey },
      data: { previewStorageKey: null, previewMimeType: null, previewBytes: null, previewExpiresAt: null },
    });
    deletedObjects += 1;
  }
  for (const storageKey of originalKeys) {
    const activeReferences = await db.mediaScanAsset.count({
      where: {
        originalStorageKey: storageKey,
        OR: [{ originalExpiresAt: null }, { originalExpiresAt: { gt: now } }],
      },
    });
    if (activeReferences > 0) continue;
    await removeStoredPreview(storageKey);
    await db.mediaScanAsset.updateMany({
      where: { originalStorageKey: storageKey },
      data: { originalStorageKey: null, originalMimeType: null, originalBytes: null, originalExpiresAt: null },
    });
    deletedObjects += 1;
  }
  for (const storageKey of pendingKeys) {
    await removeStoredPreview(storageKey);
    await db.mediaScanAsset.updateMany({
      where: { pendingStorageKey: storageKey, pendingExpiresAt: { lte: now } },
      data: { pendingStorageKey: null, pendingMimeType: null, pendingBytes: null, pendingExpiresAt: null },
    });
    deletedObjects += 1;
  }

  return { deletedObjects };
}
