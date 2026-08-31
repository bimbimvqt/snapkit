import { fail } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");
  const { id } = await context.params;
  const asset = await db.mediaScanAsset.findUnique({
    where: { id },
    select: { id: true, type: true, thumbnail: true, thumbnailMimeType: true },
  });
  if (!asset?.thumbnail) return fail("Không có thumbnail", 404, "NOT_FOUND");
  return new Response(new Uint8Array(asset.thumbnail), {
    headers: {
      "content-type": asset.thumbnailMimeType ?? "image/jpeg",
      "content-disposition": `${new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${asset.type === "VIDEO" ? "video" : "image"}-preview-${asset.id}.jpg"`,
      "content-length": String(asset.thumbnail.byteLength),
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
