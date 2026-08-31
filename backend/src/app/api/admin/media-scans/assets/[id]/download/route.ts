import { fail } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { extensionForMimeType, parseByteRange, previewStream, storedPreview } from "@/lib/media-storage";

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
      previewStorageKey: true,
      previewMimeType: true,
    },
  });
  const storageKey = asset?.originalStorageKey ?? asset?.previewStorageKey;
  const mimeType = asset?.originalMimeType ?? asset?.previewMimeType;
  if (!asset || !storageKey || !mimeType) return fail("Không có file để tải xuống", 404, "NOT_FOUND");

  try {
    const { filePath, size } = await storedPreview(storageKey);
    const range = parseByteRange(request.headers.get("range"), size);
    if (range === false) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    }
    const extension = extensionForMimeType(mimeType);
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
      return new Response(previewStream(filePath, range.start, range.end), { status: 206, headers });
    }
    headers.set("content-length", String(size));
    return new Response(previewStream(filePath), { headers });
  } catch {
    return fail("File không còn tồn tại", 404, "NOT_FOUND");
  }
}
