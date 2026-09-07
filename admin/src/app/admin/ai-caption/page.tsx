import { backendFetch, type AdminAICaptionResponse } from "@/lib/backend";
import { AICaptionPanel } from "./ai-caption-panel";

export const dynamic = "force-dynamic";

export default async function AICaptionAdminPage() {
  const data = await backendFetch<AdminAICaptionResponse>("/api/admin/ai-caption");

  return (
    <div className="grid gap-7">
      <header>
        <div className="flex items-center gap-2">
          <p className="label">AI Studio Management</p>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] px-2.5 py-0.5 text-xs font-bold text-[var(--brand-strong)]">
            Vision API
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">
          Quản trị AI Social Studio
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Quản lý model, tham số tạo nội dung, hạn mức Free/Pro và kiểm tra kết nối backend.
        </p>
      </header>
      <AICaptionPanel initialData={data} />
    </div>
  );
}
