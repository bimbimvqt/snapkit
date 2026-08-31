import { fail } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { extensionForMimeType, parseByteRange, previewStream, storedPreview } from "@/lib/media-storage";
import { createR2ReadUrl, isR2Reference } from "@/lib/r2-storage";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");
  const { id } = await context.params;
  const asset = await db.mediaScanAsset.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      originalStorageKey: true,
      originalMimeType: true,
      originalExpiresAt: true,
      previewStorageKey: true,
      previewMimeType: true,
      previewExpiresAt: true,
    },
  });
  const now = new Date();
  const originalActive = Boolean(asset?.originalStorageKey) &&
    (asset?.originalExpiresAt === null ||
      (asset?.originalExpiresAt !== undefined && asset.originalExpiresAt > now));
  const previewActive = Boolean(asset?.previewStorageKey) &&
    (asset?.previewExpiresAt === null ||
      (asset?.previewExpiresAt !== undefined && asset.previewExpiresAt > now));
  const storageKey = originalActive ? asset?.originalStorageKey : previewActive ? asset?.previewStorageKey : null;
  const mimeType = originalActive ? asset?.originalMimeType : previewActive ? asset?.previewMimeType : null;
  if (!asset || !storageKey || !mimeType) return fail("Không có file để tải xuống", 404, "NOT_FOUND");

  try {
    const extension = extensionForMimeType(mimeType);
    if (isR2Reference(storageKey)) {
      const url = await createR2ReadUrl(storageKey, {
        mimeType,
        fileName: `${asset.type.toLowerCase()}-original-${asset.id}.${extension}`,
        download: true,
      });
      return Response.redirect(url, 302);
    }
    const { filePath, size } = await storedPreview(storageKey);
    const range = parseByteRange(request.headers.get("range"), size);
    if (range === false) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    }
    const headers = new Headers({
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600",
      "content-type": mimeType,
      "content-disposition": `attachment; filename="${asset.type.toLowerCase()}-original-${asset.id}.${extension}"`,
      "x-content-type-options": "nosniff",
    });
    if (range) {
      headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
      headers.set("content-length", String(range.end - range.start + 1));
      return new Response(await previewStream(filePath, range.start, range.end), { status: 206, headers });
    }
    headers.set("content-length", String(size));
    return new Response(await previewStream(filePath), { headers });
  } catch {
    return fail("File không còn tồn tại", 404, "NOT_FOUND");
  }
}
