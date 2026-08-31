ALTER TABLE "MediaScanAsset"
ADD COLUMN "previewExpiresAt" TIMESTAMP(3),
ADD COLUMN "originalExpiresAt" TIMESTAMP(3),
ADD COLUMN "pendingStorageKey" TEXT,
ADD COLUMN "pendingMimeType" TEXT,
ADD COLUMN "pendingBytes" BIGINT,
ADD COLUMN "pendingExpiresAt" TIMESTAMP(3);

CREATE INDEX "MediaScanAsset_previewExpiresAt_idx" ON "MediaScanAsset"("previewExpiresAt");
CREATE INDEX "MediaScanAsset_originalExpiresAt_idx" ON "MediaScanAsset"("originalExpiresAt");
