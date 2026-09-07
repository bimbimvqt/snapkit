import { z } from "zod";
import { apiError, fail, ok } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { testAICaptionConnection, getAICaptionConfig } from "@/lib/caption-ai";

const testSchema = z.object({
  model: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return fail("Không có quyền truy cập", 403, "FORBIDDEN");

    const json = await request.json().catch(() => ({}));
    const input = testSchema.parse(json);

    const currentConfig = await getAICaptionConfig();

    const result = await testAICaptionConnection({
      openaiBaseUrl: currentConfig.openaiBaseUrl,
      openaiApiKey: currentConfig.openaiApiKey,
      model: input.model || currentConfig.model,
    });

    return ok(result);
  } catch (error) {
    return apiError(error);
  }
}
