"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle2,
  Radio,
  Save,
  Sparkles,
} from "lucide-react";
import Button from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeraSectionTitle, SeraSurface } from "@/components/sera/surface";
import { clientBackendFetch } from "@/lib/api-response";
import { cn } from "@/lib/utils";
import type { AdminAICaptionResponse, AdminAICaptionConfig } from "@/lib/backend";

const modelOptions = [
  { id: "gpt-5.4-mini", name: "gpt-5.4-mini (Khuyên dùng - nhanh và nhẹ)" },
  { id: "gpt-5.4", name: "gpt-5.4 (Chất lượng cao)" },
  { id: "gpt-5.5", name: "gpt-5.5 (Chất lượng cao)" },
  { id: "gpt-4o", name: "gpt-4o (Vision tiêu chuẩn)" },
  { id: "gpt-4o-mini", name: "gpt-4o-mini" },
  { id: "custom", name: "Tùy chỉnh model khác..." },
];

const toneOptions = [
  { id: "meme", name: "Meme / Hài hước (Mặc định)" },
  { id: "flirty", name: "Thả thính" },
  { id: "genz", name: "Gen Z" },
  { id: "foodie", name: "Ẩm thực" },
  { id: "deep", name: "Sâu lắng" },
  { id: "brand", name: "Thương hiệu / Marketing" },
];

export function AICaptionPanel({ initialData }: { initialData: AdminAICaptionResponse }) {
  const [config, setConfig] = useState<AdminAICaptionConfig>(initialData.config);
  const [selectedModel, setSelectedModel] = useState<string>(
    modelOptions.some((m) => m.id === initialData.config.model) ? initialData.config.model : "custom"
  );
  const [customModel, setCustomModel] = useState(
    modelOptions.some((m) => m.id === initialData.config.model) ? "" : initialData.config.model
  );

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs: number;
    modelUsed: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleTestConnection() {
    if (testing) return;
    setTesting(true);
    setTestResult(null);
    try {
      const activeModel = selectedModel === "custom" ? customModel : selectedModel;
      const result = await clientBackendFetch<NonNullable<typeof testResult>>("/api/admin/ai-caption/test", {
        method: "POST",
        body: JSON.stringify({ model: activeModel }),
      });
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : String(err),
        latencyMs: 0,
        modelUsed: selectedModel === "custom" ? customModel : selectedModel,
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSaveStatus(null);
    try {
      const activeModel = selectedModel === "custom" ? customModel : selectedModel;
      const payload = {
        enabled: config.enabled,
        provider: config.provider,
        model: activeModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        defaultTone: config.defaultTone,
        freeDailyLimit: config.freeDailyLimit,
        proDailyLimit: config.proDailyLimit,
      };

      const saved = await clientBackendFetch<AdminAICaptionResponse>("/api/admin/ai-caption", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setConfig((current) => current === config ? saved.config : current);
      setSaveStatus({ type: "success", text: "Đã lưu cấu hình vừa gửi. Các chỉnh sửa thêm trong lúc lưu cần được lưu tiếp." });
    } catch (err: unknown) {
      setSaveStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Đã có lỗi hệ thống.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      {/* Top Banner: Status & Quick Toggle */}
      <SeraSurface className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-[#102019]">
              <Sparkles size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">AI Social Studio</h2>
                <Badge size="sm" className={config.enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}>
                  {config.enabled ? "Đang bật trên App" : "Đang khóa"}
                </Badge>
              </div>
              <p className="text-xs text-[var(--ink-muted)]">
                Tạo nội dung mạng xã hội từ hình ảnh qua API tương thích OpenAI
              </p>
            </div>
          </div>

          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />
            <div className="peer h-7 w-12 rounded-full bg-zinc-700 ring-offset-2 ring-offset-[var(--surface)] after:absolute after:left-[4px] after:top-[4px] after:h-5 after:w-5 after:rounded-full after:border after:border-zinc-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[var(--brand)] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--brand)]"></div>
            <span className="ml-3 text-sm font-semibold">
              {config.enabled ? "Cho phép người dùng sử dụng" : "Tạm khóa tính năng"}
            </span>
          </label>
        </div>
      </SeraSurface>

      {/* Main Configuration Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: API Credentials & Endpoints */}
        <SeraSurface className="grid gap-5 p-6">
          <SeraSectionTitle
            eyebrow="OpenAI Connection"
            title="Cấu hình Kết nối ChatGPT"
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">
              OpenAI Base URL
            </label>
            <input
              type="text"
              value={config.openaiBaseUrl}
              readOnly
              className="w-full cursor-not-allowed rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm opacity-75 outline-none"
            />
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
              Endpoint chỉ được cấu hình bằng OPENAI_BASE_URL trên backend để bảo vệ API key.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[var(--ink)]">OpenAI API Key</p>
                <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                  Secret chỉ được đọc từ biến môi trường OPENAI_API_KEY và không bao giờ gửi xuống trình duyệt.
                </p>
              </div>
              <Badge
                size="sm"
                className={config.apiKeyConfigured ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}
              >
                {config.apiKeyConfigured ? "Đã cấu hình" : "Chưa cấu hình"}
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">
                Lựa chọn Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
              >
                {modelOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedModel === "custom" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">
                  Tên Model Tùy chỉnh
                </label>
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
                  placeholder="gpt-5.6-sol"
                />
              </div>
            )}
          </div>
        </SeraSurface>

        {/* Right Column: Generation Hyperparameters */}
        <SeraSurface className="grid gap-5 p-6">
          <SeraSectionTitle
            eyebrow="Generation parameters"
            title="Tham số Sáng tạo & Tone giọng"
          />

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">
              Tone giọng khởi tạo mặc định
            </label>
            <select
              value={config.defaultTone}
              onChange={(e) =>
                setConfig({ ...config, defaultTone: e.target.value as AdminAICaptionConfig["defaultTone"] })
              }
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
            >
              {toneOptions.map((tone) => (
                <option key={tone.id} value={tone.id}>
                  {tone.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">Lượt Free / ngày</label>
              <input
                type="number"
                min="0"
                max="100"
                value={config.freeDailyLimit}
                onChange={(e) => setConfig({ ...config, freeDailyLimit: Number.parseInt(e.target.value, 10) || 0 })}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">Lượt Pro / ngày</label>
              <input
                type="number"
                min="0"
                max="1000"
                value={config.proDailyLimit}
                onChange={(e) => setConfig({ ...config, proDailyLimit: Number.parseInt(e.target.value, 10) || 0 })}
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-[var(--ink)]">
              <span>Độ ngẫu hứng (Temperature): {config.temperature}</span>
              <span className="text-[var(--ink-muted)]">0.0 (Chuẩn mực) - 1.5 (Sáng tạo hơn)</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--line)] accent-[var(--brand)]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--ink)]">
              Giới hạn Tokens tối đa (Max Tokens)
            </label>
            <input
              type="number"
              min="200"
              max="4000"
              step="100"
              value={config.maxTokens}
              onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value, 10) || 1000 })}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
            />
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
              Mặc định 1200 tokens đủ cho 3 phiên bản kèm hashtag và gợi ý âm thanh phù hợp
            </p>
          </div>
        </SeraSurface>
      </div>

      {/* Test Connection Box & Save Actions */}
      <SeraSurface className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold">Kiểm tra kết nối & Lưu cấu hình</h3>
            <p className="text-xs text-[var(--ink-muted)]">
              Test phản hồi trực tiếp từ ChatGPT OpenAI trước khi áp dụng cho người dùng
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              iconLeft={<Radio size={16} />}
              loading={testing}
              onClick={handleTestConnection}
              className="rounded-xl border-[var(--line)] bg-[var(--surface)]"
            >
              Kiểm tra kết nối
            </Button>

            <Button
              variant="default"
              iconLeft={<Save size={16} />}
              loading={saving}
              onClick={handleSave}
              className="rounded-xl bg-[var(--accent)] font-bold text-[#102019]"
            >
              Lưu thay đổi
            </Button>
          </div>
        </div>

        {/* Save Status Notification */}
        {saveStatus && (
          <div role={saveStatus.type === "error" ? "alert" : "status"}
            className={cn(
              "mt-4 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold",
              saveStatus.type === "success"
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border border-red-500/30 bg-red-500/10 text-red-400"
            )}
          >
            <Activity size={16} />
            <span>{saveStatus.text}</span>
          </div>
        )}

        {/* Test Result Live Box */}
        {testResult && (
          <div role={testResult.success ? "status" : "alert"}
            className={cn(
              "mt-4 rounded-xl border p-4 text-xs font-mono",
              testResult.success
                ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                : "border-amber-500/40 bg-amber-950/20 text-amber-300"
            )}
          >
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                {testResult.success ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Activity size={16} className="text-amber-400" />}
                Trạng thái: {testResult.success ? "KẾT NỐI THÀNH CÔNG" : "KẾT NỐI CÓ VẤN ĐỀ"}
              </span>
              <span>Độ trễ: {testResult.latencyMs}ms · Model: {testResult.modelUsed}</span>
            </div>
            <p className="mt-2 leading-relaxed opacity-90">{testResult.message}</p>
          </div>
        )}
      </SeraSurface>
    </div>
  );
}
