ALTER TABLE "MediaScanAsset"
ADD COLUMN "previewStorageKey" TEXT,
ADD COLUMN "previewMimeType" TEXT,
ADD COLUMN "previewBytes" BIGINT;
