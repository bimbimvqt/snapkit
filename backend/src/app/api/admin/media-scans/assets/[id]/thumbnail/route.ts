import { fail } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_request: Request, context: RouteContext<"/api/admin/media-scans/assets/[id]/thumbnail">) {
  if (!(await requireAdmin())) return fail("Không có quyền truy cập", 403, "FORBIDDEN");
  const { id } = await context.params;
  const asset = await db.mediaScanAsset.findUnique({
    where: { id },
    select: { thumbnail: true, thumbnailMimeType: true },
  });
  if (!asset?.thumbnail) return fail("Không có thumbnail", 404, "NOT_FOUND");
  return new Response(new Uint8Array(asset.thumbnail), {
    headers: {
      "content-type": asset.thumbnailMimeType ?? "image/jpeg",
      "cache-control": "private, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
