import { fail } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  browserVideoStorageKeyFor,
  extensionForMimeType,
  parseByteRange,
  previewStream,
  removeStoredPreview,
  storedPreview,
  transcodeBrowserVideo,
} from "@/lib/media-storage";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");
  const { id } = await context.params;
  const asset = await db.mediaScanAsset.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      previewStorageKey: true,
      previewMimeType: true,
      originalStorageKey: true,
    },
  });
  if (!asset) return fail("Không có file preview", 404, "NOT_FOUND");

  try {
    let storageKey = asset.previewStorageKey;
    let mimeType = asset.previewMimeType;
    if ((!storageKey || mimeType !== "video/mp4") && asset.type === "VIDEO" && asset.originalStorageKey) {
      const previousPreview = storageKey;
      storageKey = browserVideoStorageKeyFor(asset.id);
      const previewBytes = await transcodeBrowserVideo(asset.originalStorageKey, storageKey);
      mimeType = "video/mp4";
      await db.mediaScanAsset.update({
        where: { id: asset.id },
        data: { previewStorageKey: storageKey, previewMimeType: mimeType, previewBytes: BigInt(previewBytes) },
      });
      if (previousPreview !== asset.originalStorageKey) {
        await removeStoredPreview(previousPreview);
      }
    }
    if (!storageKey || !mimeType) return fail("Không có file preview", 404, "NOT_FOUND");

    const { filePath, size } = await storedPreview(storageKey);
    const rangeHeader = request.headers.get("range");
    const range = parseByteRange(rangeHeader, size);
    if (range === false) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    }
    const download = new URL(request.url).searchParams.get("download") === "1";
    const extension = extensionForMimeType(mimeType);
    const headers = new Headers({
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600",
      "content-type": mimeType,
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${asset.type.toLowerCase()}-preview-${asset.id}.${extension}"`,
      "x-content-type-options": "nosniff",
    });
    if (range) {
      headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
      headers.set("content-length", String(range.end - range.start + 1));
      return new Response(previewStream(filePath, range.start, range.end), { status: 206, headers });
    }
    headers.set("content-length", String(size));
    return new Response(previewStream(filePath), { headers });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("VIDEO_TRANSCODE_FAILED") || error.message.includes("spawn ffmpeg"))
    ) {
      return fail("Không thể tạo bản video tương thích trình duyệt", 500, "VIDEO_TRANSCODE_FAILED");
    }
    return fail("File preview không còn tồn tại", 404, "NOT_FOUND");
  }
}
