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
    select: { id: true, type: true, previewStorageKey: true, previewMimeType: true },
  });
  if (!asset?.previewStorageKey || !asset.previewMimeType) return fail("Không có file preview", 404, "NOT_FOUND");

  try {
    const { filePath, size } = await storedPreview(asset.previewStorageKey);
    const rangeHeader = request.headers.get("range");
    const range = parseByteRange(rangeHeader, size);
    if (range === false) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    }
    const download = new URL(request.url).searchParams.get("download") === "1";
    const extension = extensionForMimeType(asset.previewMimeType);
    const headers = new Headers({
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600",
      "content-type": asset.previewMimeType,
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
  } catch {
    return fail("File preview không còn tồn tại", 404, "NOT_FOUND");
  }
}
