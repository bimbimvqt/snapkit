"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, CircleDollarSign, Crown, HardDrive, Plus, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import Button from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SeraSectionTitle, SeraSurface } from "@/components/sera/surface";
import type { SubscriptionPlan, SubscriptionPlanConfig, SubscriptionStoragePolicy } from "@/lib/backend";
import { clientBackendFetch } from "@/lib/api-response";

function fieldClass() {
  return "min-h-12 w-full rounded-2xl border bg-[var(--surface-raised)] px-4 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--brand)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--brand)_16%,transparent)]";
}

function TextField({ label, hint, multiline, value, onChange, type = "text", min, max }: {
  label: string;
  hint?: string;
  multiline?: boolean;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
  min?: number;
  max?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className={`${fieldClass()} resize-y py-3 leading-6`} />
      ) : (
        <input type={type} min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass()} />
      )}
      {hint && <span className="text-xs font-normal leading-5 text-[var(--ink-muted)]">{hint}</span>}
    </label>
  );
}

function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border bg-[var(--surface-raised)] px-4 text-left transition hover:border-[var(--brand)]">
      <span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-[var(--ink-muted)]">{description}</span></span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[var(--brand)]" : "bg-[var(--line)]"}`}><span className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${checked ? "translate-x-6" : "translate-x-1"}`} /></span>
    </button>
  );
}

function PreviewCard({ plan }: { plan: SubscriptionPlan }) {
  return (
    <article className={`relative flex min-h-[31rem] flex-col rounded-3xl border p-6 ${plan.highlighted ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_8%,var(--surface-raised))] shadow-[0_22px_70px_color-mix(in_srgb,var(--brand)_14%,transparent)]" : "bg-[var(--surface-raised)]"}`}>
      {plan.badge && <Badge className="absolute right-5 top-5 bg-[var(--brand)] text-white">{plan.badge}</Badge>}
      <span className="grid size-11 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-strong)]"><Crown size={21} aria-hidden="true" /></span>
      <h3 className="mt-5 pr-24 text-xl font-bold">{plan.name || "Tên gói"}</h3>
      <div className="mt-5 flex items-end gap-2"><span className="text-4xl font-black tracking-tight tabular-nums">{plan.priceLabel || "—"}</span><span className="pb-1 text-sm text-[var(--ink-muted)]">{plan.periodLabel}</span></div>
      <p className="mt-4 min-h-16 text-sm leading-6 text-[var(--ink-muted)]">{plan.description || "Mô tả gói Pro"}</p>
      <p className="mt-3 flex items-center gap-2 rounded-2xl bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink-muted)]">
        <HardDrive size={15} aria-hidden="true" />
        {(plan.storage.quotaMb / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} GB cloud · video gốc {plan.storage.originalVideoRetentionDays} ngày
      </p>
      <ul className="mt-5 grid gap-3">
        {plan.features.filter(Boolean).map((feature) => <li key={feature} className="flex gap-3 text-sm"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] text-[var(--brand-strong)]"><Check size={13} strokeWidth={3} aria-hidden="true" /></span><span>{feature}</span></li>)}
      </ul>
      <span className="mt-auto flex min-h-12 items-center justify-center rounded-2xl bg-[var(--ink)] px-5 text-sm font-bold text-[var(--surface)]">{plan.ctaLabel || "Chọn gói"}</span>
      {plan.trialDays > 0 && <p className="mt-3 text-center text-xs text-[var(--ink-muted)]">Dùng thử {plan.trialDays} ngày · Huỷ bất kỳ lúc nào</p>}
    </article>
  );
}

function normalizeOrder(plans: SubscriptionPlan[]) {
  return plans.map((plan, index) => ({ ...plan, sortOrder: index }));
}

export function SubscriptionPlanEditor({ initialConfig, updatedAt }: { initialConfig: SubscriptionPlanConfig; updatedAt: string | null }) {
  const [config, setConfig] = useState(initialConfig);
  const [persisted, setPersisted] = useState(initialConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string }>();
  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(persisted), [config, persisted]);
  const enabledPlans = config.plans.filter((plan) => plan.enabled).sort((a, b) => a.sortOrder - b.sortOrder);

  function updatePlan(index: number, patch: Partial<SubscriptionPlan>) {
    setConfig((current) => ({ ...current, plans: current.plans.map((plan, planIndex) => planIndex === index ? { ...plan, ...patch } : plan) }));
  }

  function updatePlanStorage(index: number, patch: Partial<SubscriptionStoragePolicy>) {
    setConfig((current) => ({
      ...current,
      plans: current.plans.map((plan, planIndex) =>
        planIndex === index ? { ...plan, storage: { ...plan.storage, ...patch } } : plan),
    }));
  }

  function movePlan(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= config.plans.length) return;
    setConfig((current) => {
      const plans = [...current.plans];
      [plans[index], plans[target]] = [plans[target], plans[index]];
      return { ...current, plans: normalizeOrder(plans) };
    });
  }

  function addPlan() {
    const suffix = String(Date.now()).slice(-6);
    setConfig((current) => ({ ...current, plans: [...current.plans, {
      id: `plan-${suffix}`, productId: `snapkit_pro_${suffix}`, name: "Gói Pro mới", badge: "", price: 0, currency: "VND", priceLabel: "Liên hệ", periodLabel: "/ tháng", trialDays: 0, ctaLabel: "Chọn gói", description: "Mô tả quyền lợi phù hợp với người dùng.", features: ["Tính năng Pro"], benefits: ["Huỷ bất kỳ lúc nào"], highlighted: false, enabled: false, sortOrder: current.plans.length, storage: { quotaMb: 10240, maxVideoUploadMb: 512, previewRetentionDays: 365, originalVideoRetentionDays: 30 },
    }] }));
  }

  function removePlan(index: number) {
    if (config.plans.length <= 1) { setMessage({ kind: "error", text: "Cần giữ lại ít nhất một gói." }); return; }
    setConfig((current) => ({ ...current, plans: normalizeOrder(current.plans.filter((_, planIndex) => planIndex !== index)) }));
  }

  async function save() {
    if (saving) return;
    setSaving(true); setMessage(undefined);
    try {
      const saved = await clientBackendFetch<{ config: SubscriptionPlanConfig }>("/api/admin/subscription-plans", { method: "PUT", body: JSON.stringify({ ...config, plans: normalizeOrder(config.plans) }) });
      setConfig((current) => current === config ? saved.config : current);
      setPersisted(saved.config);
      setMessage({ kind: "success", text: "Đã lưu phiên bản vừa gửi. Các chỉnh sửa thêm trong lúc lưu cần được lưu tiếp." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Không thể lưu cấu hình gói Pro" });
    } finally { setSaving(false); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 gap-6">
        <SeraSurface className="p-5 sm:p-6">
          <SeraSectionTitle eyebrow="Nội dung paywall" title="Thông điệp chung" />
          <div className="mt-5 grid gap-4">
            <TextField label="Tiêu đề" value={config.title} onChange={(title) => setConfig((current) => ({ ...current, title }))} />
            <TextField label="Mô tả" multiline value={config.subtitle} onChange={(subtitle) => setConfig((current) => ({ ...current, subtitle }))} />
            <TextField label="Cam kết thanh toán" multiline value={config.footer} onChange={(footer) => setConfig((current) => ({ ...current, footer }))} hint="Hiển thị phía cuối pricing section để tăng độ tin cậy." />
          </div>
        </SeraSurface>

        <SeraSurface className="p-5 sm:p-6">
          <SeraSectionTitle eyebrow="Cloudflare R2" title="Giới hạn gói Free" />
          <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">Áp dụng khi tài khoản không có subscription ACTIVE. Giá trị 0 ngày nghĩa là xoá video gốc ngay sau khi tạo preview.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField label="Quota (MB)" type="number" min={50} max={1048576} value={config.freeStorage.quotaMb} onChange={(value) => setConfig((current) => ({ ...current, freeStorage: { ...current.freeStorage, quotaMb: Number(value) } }))} />
            <TextField label="Video tối đa (MB)" type="number" min={0} max={4096} value={config.freeStorage.maxVideoUploadMb} onChange={(value) => setConfig((current) => ({ ...current, freeStorage: { ...current.freeStorage, maxVideoUploadMb: Number(value) } }))} />
            <TextField label="Giữ preview (ngày)" type="number" min={1} max={3650} value={config.freeStorage.previewRetentionDays} onChange={(value) => setConfig((current) => ({ ...current, freeStorage: { ...current.freeStorage, previewRetentionDays: Number(value) } }))} />
            <TextField label="Giữ video gốc (ngày)" type="number" min={0} max={3650} value={config.freeStorage.originalVideoRetentionDays} onChange={(value) => setConfig((current) => ({ ...current, freeStorage: { ...current.freeStorage, originalVideoRetentionDays: Number(value) } }))} />
          </div>
        </SeraSurface>

        {config.plans.map((plan, index) => (
          <SeraSurface key={`${plan.id}-${index}`} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6">
              <div><p className="label">Gói {index + 1}</p><h2 className="mt-1 text-lg font-bold">{plan.name}</h2></div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" iconLeft={<ArrowUp size={18} />} aria-label="Đưa gói lên" disabled={index === 0} onClick={() => movePlan(index, -1)} />
                <Button variant="ghost" iconLeft={<ArrowDown size={18} />} aria-label="Đưa gói xuống" disabled={index === config.plans.length - 1} onClick={() => movePlan(index, 1)} />
                <Button variant="destructive" iconLeft={<Trash2 size={18} />} aria-label="Xoá gói" onClick={() => removePlan(index)} />
              </div>
            </div>
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <TextField label="Mã gói" value={plan.id} onChange={(id) => updatePlan(index, { id })} hint="Chữ thường, số, dấu _ hoặc -. Không đổi sau khi phát hành." />
              <TextField label="Product ID cửa hàng" value={plan.productId} onChange={(productId) => updatePlan(index, { productId })} hint="Phải khớp App Store Connect / Play Console." />
              <TextField label="Tên gói" value={plan.name} onChange={(name) => updatePlan(index, { name })} />
              <TextField label="Badge" value={plan.badge} onChange={(badge) => updatePlan(index, { badge })} hint="Ví dụ: Phổ biến, Tiết kiệm 25%." />
              <TextField label="Giá số" type="number" min={0} max={1000000000} value={plan.price} onChange={(price) => updatePlan(index, { price: Number(price) })} hint="Dùng cho analytics; giá cửa hàng vẫn là nguồn chính khi thanh toán." />
              <TextField label="Mã tiền tệ" value={plan.currency} onChange={(currency) => updatePlan(index, { currency: currency.toUpperCase() })} />
              <TextField label="Giá hiển thị" value={plan.priceLabel} onChange={(priceLabel) => updatePlan(index, { priceLabel })} hint="Ví dụ: 79.000đ" />
              <TextField label="Chu kỳ" value={plan.periodLabel} onChange={(periodLabel) => updatePlan(index, { periodLabel })} hint="Ví dụ: / tháng" />
              <TextField label="Số ngày dùng thử" type="number" min={0} max={365} value={plan.trialDays} onChange={(trialDays) => updatePlan(index, { trialDays: Number(trialDays) })} />
              <TextField label="Nhãn CTA" value={plan.ctaLabel} onChange={(ctaLabel) => updatePlan(index, { ctaLabel })} />
              <div className="sm:col-span-2"><TextField label="Mô tả gói" multiline value={plan.description} onChange={(description) => updatePlan(index, { description })} /></div>
              <TextField label="Tính năng" multiline value={plan.features.join("\n")} onChange={(value) => updatePlan(index, { features: value.split("\n").map((item) => item.trim()).filter(Boolean) })} hint="Mỗi dòng là một tính năng trong checklist." />
              <TextField label="Tiện ích / cam kết" multiline value={plan.benefits.join("\n")} onChange={(value) => updatePlan(index, { benefits: value.split("\n").map((item) => item.trim()).filter(Boolean) })} hint="Mỗi dòng là một tiện ích phía cuối thẻ." />
              <div className="grid gap-4 rounded-3xl border bg-[var(--surface)] p-4 sm:col-span-2 sm:grid-cols-2">
                <div className="sm:col-span-2"><p className="text-sm font-bold">Lưu trữ Cloudflare R2</p><p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">Policy được backend áp dụng theo Product ID của subscription ACTIVE.</p></div>
                <TextField label="Quota (MB)" type="number" min={50} max={1048576} value={plan.storage.quotaMb} onChange={(value) => updatePlanStorage(index, { quotaMb: Number(value) })} />
                <TextField label="Video tối đa (MB)" type="number" min={0} max={4096} value={plan.storage.maxVideoUploadMb} onChange={(value) => updatePlanStorage(index, { maxVideoUploadMb: Number(value) })} />
                <TextField label="Giữ preview (ngày)" type="number" min={1} max={3650} value={plan.storage.previewRetentionDays} onChange={(value) => updatePlanStorage(index, { previewRetentionDays: Number(value) })} />
                <TextField label="Giữ video gốc (ngày)" type="number" min={0} max={3650} value={plan.storage.originalVideoRetentionDays} onChange={(value) => updatePlanStorage(index, { originalVideoRetentionDays: Number(value) })} />
              </div>
              <Switch checked={plan.enabled} onChange={(enabled) => updatePlan(index, { enabled })} label="Hiển thị trên app" description="Có thể tắt gói mà không cần xoá cấu hình." />
              <Switch checked={plan.highlighted} onChange={(highlighted) => setConfig((current) => ({ ...current, plans: current.plans.map((item, planIndex) => ({ ...item, highlighted: planIndex === index ? highlighted : highlighted ? false : item.highlighted })) }))} label="Gói đề xuất" description="Chỉ một gói được làm nổi bật trên pricing section." />
            </div>
          </SeraSurface>
        ))}

        <Button variant="outline" size="lg" iconLeft={<Plus size={19} />} onClick={addPlan} disabled={config.plans.length >= 6} className="min-h-14 rounded-2xl border-dashed">Thêm gói Pro</Button>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-28 xl:self-start">
        <SeraSurface className="overflow-hidden">
          <div className="border-b p-5"><p className="label">SeraUI preview</p><h2 className="mt-2 text-xl font-bold">{config.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">{config.subtitle}</p></div>
          <div className="grid gap-4 bg-[var(--surface)] p-4">
            {enabledPlans.length > 0 ? enabledPlans.map((plan) => <PreviewCard key={plan.id} plan={plan} />) : <div className="grid min-h-64 place-items-center rounded-3xl border border-dashed p-6 text-center"><div><Sparkles className="mx-auto text-[var(--ink-muted)]" size={30} /><p className="mt-3 text-sm font-semibold">Chưa có gói đang bật</p></div></div>}
          </div>
          <div className="grid gap-3 border-t p-5 text-xs leading-5 text-[var(--ink-muted)]">
            <p className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-[var(--brand-strong)]" size={16} />{config.footer}</p>
            <p className="flex gap-2"><CircleDollarSign className="mt-0.5 shrink-0" size={16} />Giá trả tiền thực tế phải lấy từ App Store hoặc Google Play.</p>
          </div>
        </SeraSurface>
        <div className="mt-4 grid gap-3 rounded-3xl border bg-[var(--surface)] p-4 shadow-xl">
          {updatedAt && <p className="text-xs text-[var(--ink-muted)]">Lần lưu trước: {new Date(updatedAt).toLocaleString("vi-VN")}</p>}
          {message && <p role={message.kind === "error" ? "alert" : "status"} className={`rounded-2xl p-3 text-sm ${message.kind === "error" ? "bg-red-500/10 text-[var(--danger)]" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>{message.text}</p>}
          <Button size="lg" iconLeft={<Save size={19} />} loading={saving} disabled={!dirty} onClick={save} className="min-h-12 rounded-2xl">Lưu & đồng bộ</Button>
        </div>
      </aside>
    </div>
  );
}
