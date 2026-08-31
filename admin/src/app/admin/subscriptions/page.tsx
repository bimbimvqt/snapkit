import { backendFetch, type AdminSubscriptionPlans } from "@/lib/backend";
import { SubscriptionPlanEditor } from "./subscription-plan-editor";

export default async function SubscriptionsPage() {
  const data = await backendFetch<AdminSubscriptionPlans>("/api/admin/subscription-plans");
  return (
    <div className="grid gap-7">
      <header>
        <p className="label">Monetization</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Gói Snapkit Pro</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
          Quản lý nội dung paywall, giá hiển thị, Product ID, tính năng và tiện ích. Thay đổi được đồng bộ tới ứng dụng qua remote config.
        </p>
      </header>
      <SubscriptionPlanEditor initialConfig={data.config} updatedAt={data.updatedAt} />
    </div>
  );
}
