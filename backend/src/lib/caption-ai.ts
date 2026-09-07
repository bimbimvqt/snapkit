import { z } from "zod";
import { db } from "@/lib/db";

const captionToneSchema = z.enum(["meme", "flirty", "genz", "deep", "foodie", "brand"]);
const socialPlatformSchema = z.enum(["instagram", "threads", "tiktok", "facebook"]);
const imageDataUrlSchema = z
  .string()
  .min(32)
  .max(1_500_000)
  .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Ảnh tải lên không hợp lệ");

export const captionRequestSchema = z.object({
  images: z.array(imageDataUrlSchema).min(1).max(4),
  tone: captionToneSchema.default("meme"),
  platform: socialPlatformSchema.default("instagram"),
  language: z.enum(["vi", "en"]).default("vi"),
  contextHint: z.string().trim().max(200).optional(),
});

export type CaptionRequest = z.infer<typeof captionRequestSchema>;

export const aiCaptionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.literal("openai").default("openai"),
  openaiBaseUrl: z.string().url().default("https://api.skytruong.com/v1"),
  model: z.string().trim().min(1).max(120).default("gpt-5.4-mini"),
  temperature: z.number().min(0).max(2).default(0.85),
  maxTokens: z.number().int().min(100).max(4096).default(1200),
  defaultTone: captionToneSchema.default("meme"),
  freeDailyLimit: z.number().int().min(0).max(100).default(3),
  proDailyLimit: z.number().int().min(0).max(1000).default(30),
});
export const aiCaptionEditableConfigSchema = aiCaptionConfigSchema.omit({ openaiBaseUrl: true }).partial();

export type AICaptionPublicConfig = z.infer<typeof aiCaptionConfigSchema> & { apiKeyConfigured: boolean };
export type AICaptionConfig = z.infer<typeof aiCaptionConfigSchema> & { openaiApiKey: string };

export class AICaptionProviderError extends Error {
  constructor(cause?: unknown) {
    super("Dịch vụ AI chưa thể tạo nội dung. Vui lòng thử lại sau.", { cause });
    this.name = "AICaptionProviderError";
  }
}

const serverOpenAIBaseUrl = process.env.OPENAI_BASE_URL || "https://api.skytruong.com/v1";

export const defaultAICaptionConfig: AICaptionConfig = {
  enabled: true,
  provider: "openai",
  openaiBaseUrl: serverOpenAIBaseUrl,
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
  model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
  temperature: 0.85,
  maxTokens: 1200,
  defaultTone: "meme",
  freeDailyLimit: 3,
  proDailyLimit: 30,
};

export async function getAICaptionConfig(): Promise<AICaptionConfig> {
  try {
    const record = await db.appConfig.findUnique({ where: { key: "ai_caption" } });
    if (record?.value && typeof record.value === "object") {
      const parsed = aiCaptionConfigSchema.parse({
        ...defaultAICaptionConfig,
        ...(record.value as Record<string, unknown>),
      });
      return {
        ...parsed,
        openaiBaseUrl: serverOpenAIBaseUrl,
        openaiApiKey: process.env.OPENAI_API_KEY?.trim() || "",
      };
    }
  } catch (err) {
    console.warn("Could not read ai_caption config from DB, using defaults:", err);
  }
  return defaultAICaptionConfig;
}

export function publicAICaptionConfig(config: AICaptionConfig): AICaptionPublicConfig {
  const { openaiApiKey, ...publicConfig } = config;
  return { ...publicConfig, apiKeyConfigured: openaiApiKey.length > 0 };
}

export interface CaptionVariant {
  id: string;
  hookHeadline: string;
  body: string;
  oneLiner: string;
  suggestedAudio: string;
  viralScore: number;
}

export interface CaptionResponseData {
  detectedTags: string[];
  vibeSummary: string;
  variants: CaptionVariant[];
  hashtags: {
    trending: string[];
    topic: string[];
    community: string[];
  };
}

const captionResponseSchema = z.object({
  detectedTags: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  vibeSummary: z.string().trim().max(500).default(""),
  variants: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(32),
        hookHeadline: z.string().trim().max(500).default(""),
        body: z.string().trim().min(1).max(4000),
        oneLiner: z.string().trim().max(1000).default(""),
        suggestedAudio: z.string().trim().max(300).default(""),
        viralScore: z.number().int().min(0).max(100).default(0),
      })
    )
    .min(1)
    .max(4),
  hashtags: z.object({
    trending: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
    topic: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
    community: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  }),
});

export async function generateSocialCaptions(
  params: CaptionRequest,
  providedConfig?: AICaptionConfig
): Promise<CaptionResponseData> {
  const config = providedConfig ?? (await getAICaptionConfig());

  if (!config.enabled) {
    throw new Error("Tính năng AI Caption Studio hiện đang tạm khóa bởi quản trị viên.");
  }
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY chưa được cấu hình trên máy chủ.");
  }

  try {
    const openAIResult = await callOpenAIChatGPT(params, config);
    if (openAIResult) return openAIResult;
  } catch (error) {
    // Provider JSON/schema failures are upstream errors, not invalid app input.
    throw new AICaptionProviderError(error);
  }
  throw new AICaptionProviderError();
}

async function callOpenAIChatGPT(
  params: CaptionRequest,
  config: AICaptionConfig
): Promise<CaptionResponseData | null> {
  const promptText = `
Bạn là AI chuyên gia đọc hiểu hình ảnh và sáng tạo nội dung cho Instagram, Threads, TikTok và Facebook.
Nhiệm vụ: Quan sát kỹ đối tượng, chi tiết, biểu cảm, màu sắc và bối cảnh trong ảnh để tạo nội dung chính xác, tự nhiên và phù hợp nền tảng. Không suy đoán sự kiện, danh tính hoặc xu hướng thời gian thực mà ảnh không thể hiện.
Yêu cầu:
- Tone giọng: ${params.tone}
- Nền tảng: ${params.platform}
- Ngôn ngữ: ${params.language === "vi" ? "Tiếng Việt" : "English"}
- viralScore là điểm 0–100 về mức độ phù hợp giữa nội dung, ảnh, tone và nền tảng; không phải dự đoán lượt xem.
${params.contextHint ? `- Ngữ cảnh bổ sung: ${params.contextHint}` : ""}

Nếu có từ 2 ảnh trở lên: Hãy xem xét mối liên hệ giữa các ảnh (như meme recreation, so sánh trước/sau, hoặc câu chuyện ghép nối).
Nếu có 1 ảnh: Nhận diện cụ thể chủ thể chính (thức ăn, trang phục, phong cảnh, cử chỉ, đồ vật).

BẮT BUỘC: Trả về DUY NHẤT một chuỗi JSON hợp lệ (không kèm giải thích markdown ngoài JSON) theo đúng cấu trúc TypeScript này:
{
  "detectedTags": ["chủ thể 1", "chủ thể 2", "cảm xúc"],
  "vibeSummary": "Mô tả ngắn gọn 1 câu về những gì thực sự thấy trong ảnh",
  "variants": [
    {
      "id": "v1",
      "hookHeadline": "Tiêu đề giật tít thu hút mắt trong 1 giây đầu",
      "body": "Nội dung caption chi tiết miêu tả đúng ảnh, ngắt dòng đẹp mắt, có icon sinh động, kêu gọi tương tác",
      "oneLiner": "Một câu chốt ngắn gọn, hài hước/thâm thúy hợp làm status Threads hoặc Story",
      "suggestedAudio": "Tên bài hát hoặc phong cách âm thanh phù hợp với nội dung",
      "viralScore": 98
    },
    {
      "id": "v2",
      "hookHeadline": "Tiêu đề phiên bản 2",
      "body": "Nội dung phiên bản 2",
      "oneLiner": "Một câu chốt ngắn gọn 2",
      "suggestedAudio": "Tên bài hát 2",
      "viralScore": 94
    },
    {
      "id": "v3",
      "hookHeadline": "Tiêu đề phiên bản 3",
      "body": "Nội dung phiên bản 3",
      "oneLiner": "Một câu chốt ngắn gọn 3",
      "suggestedAudio": "Tên bài hát 3",
      "viralScore": 90
    }
  ],
  "hashtags": {
    "trending": ["#tag1", "#tag2"],
    "topic": ["#tag3", "#tag4"],
    "community": ["#tag5", "#tag6"]
  }
}
`;

  const userContentParts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: promptText },
  ];

  for (const img of params.images) {
    const url = img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`;
    userContentParts.push({
      type: "image_url",
      image_url: { url },
    });
  }

  const endpoint = `${config.openaiBaseUrl.replace(/\/+$/, "")}/chat/completions`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content:
              "Bạn là hệ thống AI Vision tạo caption mạng xã hội. BẮT BUỘC chỉ trả về định dạng JSON thuần túy, không bao bọc thêm bất kỳ văn bản nào ngoài JSON.",
          },
          { role: "user", content: userContentParts },
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`AI_PROVIDER_HTTP_${res.status}`);

    const data = await res.json();
    const rawText = data?.choices?.[0]?.message?.content;
    if (typeof rawText !== "string" || rawText.trim().length === 0) return null;
    return captionResponseSchema.parse(JSON.parse(extractJsonFromResponse(rawText)));
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractJsonFromResponse(text: string): string {
  const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1).trim();
  }
  return text.trim();
}

/**
 * Test the configured AI provider without exposing provider details or credentials.
 */
export async function testAICaptionConnection(
  config: Pick<AICaptionConfig, "openaiBaseUrl" | "openaiApiKey" | "model">
): Promise<{ success: boolean; message: string; latencyMs: number; modelUsed: string }> {
  const start = Date.now();
  const endpoint = `${config.openaiBaseUrl.replace(/\/+$/, "")}/chat/completions`;

  if (!config.openaiApiKey) {
    return { success: false, message: "OPENAI_API_KEY chưa được cấu hình trên backend.", latencyMs: 0, modelUsed: config.model };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: "Ping! Hãy trả lời 'Snapkit AI sẵn sàng' bằng tiếng Việt." }],
        max_tokens: 30,
      }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - start;
    if (res.ok) {
      return {
        success: true,
        message: `Kết nối thành công qua model ${config.model} (${latencyMs}ms).`,
        latencyMs,
        modelUsed: config.model,
      };
    }
  } catch {
    // A friendly status is returned below without exposing provider details.
  } finally {
    clearTimeout(timeoutId);
  }

  const latencyMs = Date.now() - start;
  return {
    success: false,
    message: "Không thể kết nối đến dịch vụ AI. Vui lòng kiểm tra cấu hình backend.",
    latencyMs,
    modelUsed: config.model,
  };
}
