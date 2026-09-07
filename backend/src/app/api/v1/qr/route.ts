import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Màu phải có định dạng #RRGGBB");
export const qrStyleSchema = z.object({
  foreground: hexColor,
  background: hexColor,
  frameColor: hexColor.optional(),
  frameSecondaryColor: hexColor.optional(),
  frameBackground: hexColor.optional(),
  iconColor: hexColor.optional(),
  logoBackground: hexColor.optional(),
  borderWidth: z.number().min(0).max(12).optional(),
  cornerRadius: z.number().min(0).max(40).optional(),
  framePadding: z.number().min(8).max(40).optional(),
  logoScale: z.number().min(0.14).max(0.28).optional(),
  eyeShape: z.enum(["square", "circle"]).optional(),
  moduleShape: z.enum(["square", "circle"]).optional(),
  frameStyle: z.enum(["none", "simple", "rounded", "badge", "rainbow", "floral"]).optional(),
  frameShape: z.enum(["rounded", "square", "ticket"]).optional(),
  frameShadow: z.enum(["none", "soft", "glow"]).optional(),
  frameLabel: z.string().trim().max(32).optional(),
  icon: z.enum(["none", "shield", "link", "wifi", "heart", "business", "custom"]).optional(),
  logoShape: z.enum(["rounded", "circle", "square"]).optional(),
  // Kept for clients released before the richer QR style model.
  rounded: z.boolean().optional(),
});

const schema = z.object({
  deviceId: z.string().min(8).max(80),
  kind: z.enum(["text", "url", "wifi", "vcard", "bank"]),
  content: z.string().min(1).max(4096),
  style: qrStyleSchema.optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return fail("Vui lòng đăng nhập để xem lịch sử QR", 401, "UNAUTHORIZED");
    const codes = await db.qrCode.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, kind: true, content: true, style: true, createdAt: true } });
    return ok(codes);
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Vui lòng đăng nhập để đồng bộ mã QR", 401, "UNAUTHORIZED");
    const input = schema.parse(await request.json());
    const code = await db.qrCode.create({ data: { ...input, userId: session.userId } });
    return ok({ id: code.id, createdAt: code.createdAt }, { status: 201 });
  } catch (error) { return apiError(error); }
}
