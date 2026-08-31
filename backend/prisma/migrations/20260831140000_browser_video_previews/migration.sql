ALTER TABLE "MediaScanAsset"
ADD COLUMN "originalStorageKey" TEXT,
ADD COLUMN "originalMimeType" TEXT,
ADD COLUMN "originalBytes" BIGINT;

-- Existing video uploads are source files, even though older releases stored
-- them in the preview columns. Preserve them as originals and let the Admin
-- preview endpoint create the browser-compatible MP4 on first use.
UPDATE "MediaScanAsset"
SET
  "originalStorageKey" = "previewStorageKey",
  "originalMimeType" = "previewMimeType",
  "originalBytes" = "previewBytes",
  "previewStorageKey" = NULL,
  "previewMimeType" = NULL,
  "previewBytes" = NULL
WHERE type = 'VIDEO' AND "previewStorageKey" IS NOT NULL;
