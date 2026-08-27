import { z } from "zod";
import { db } from "@/lib/db";
import { apiError, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Màu phải có định dạng #RRGGBB");
export const qrStyleSchema = z.object({
  foreground: hexColor,
  background: hexColor,
  frameColor: hexColor.optional(),
  iconColor: hexColor.optional(),
  borderWidth: z.number().min(0).max(12).optional(),
  cornerRadius: z.number().min(0).max(36).optional(),
  eyeShape: z.enum(["square", "circle"]).optional(),
  moduleShape: z.enum(["square", "circle"]).optional(),
  frameStyle: z.enum(["none", "simple", "rounded", "badge"]).optional(),
  icon: z.enum(["none", "shield", "link", "wifi", "heart", "business"]).optional(),
  // Kept for clients released before the richer QR style model.
  rounded: z.boolean().optional(),
});

const schema = z.object({
  deviceId: z.string().min(8).max(80),
  kind: z.enum(["text", "url", "wifi", "vcard", "bank"]),
  content: z.string().min(1).max(4096),
  style: qrStyleSchema.optional(),
});

export async function GET(request: Request) {
  const session = await getSession();
  const deviceId = new URL(request.url).searchParams.get("deviceId");
  const codes = await db.qrCode.findMany({ where: session ? { userId: session.userId } : { deviceId: deviceId ?? "__missing__" }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, kind: true, content: true, style: true, createdAt: true } });
  return ok(codes);
}

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const session = await getSession();
    const code = await db.qrCode.create({ data: { ...input, userId: session?.userId } });
    return ok({ id: code.id, createdAt: code.createdAt }, { status: 201 });
  } catch (error) { return apiError(error); }
}
