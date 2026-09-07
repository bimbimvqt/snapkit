import { Activity, HardDrive, QrCode, Users } from "lucide-react";
import { DashboardAnalytics } from "@/app/admin/dashboard-analytics";
import { MetricCard } from "@/components/admin/metric-card";
import { Badge } from "@/components/ui/badge";
import { backendFetch } from "@/lib/backend";
import { normalizeOverview } from "@/lib/overview";

const formatBytes = (value: number) => {
  if (value >= 1_073_741_824) return `${(value / 1_073_741_824).toFixed(1)} GB`;
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(0)} MB`;
  return `${Math.round(value / 1024).toLocaleString("vi-VN")} KB`;
};

export default async function DashboardPage() {
  const data = normalizeOverview(await backendFetch<unknown>("/api/admin/overview"));
  const updatedAt = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(data.period.end));

  return (
    <div className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="label">Analytics · 30 ngày gần nhất</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Tổng quan vận hành</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            Theo dõi tăng trưởng người dùng, mức độ sử dụng, hiệu quả dọn dẹp và chất lượng đồng bộ media trong cùng
            một màn hình.
          </p>
        </div>
        <Badge
          size="md"
          className="bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-strong)]"
        >
          {data.apiVersion === "legacy" ? "Một số thống kê chưa có dữ liệu" : `Cập nhật ${updatedAt}`}
        </Badge>
      </header>

      <div className="metric-grid">
        <MetricCard
          icon={Users}
          value={data.audience.activeUsers.toLocaleString("vi-VN")}
          label="Người dùng hoạt động"
          note={`${data.audience.newUsers.toLocaleString("vi-VN")} tài khoản mới · ${data.audience.totalUsers.toLocaleString("vi-VN")} tổng tài khoản`}
          change={data.audience.newUsersChange}
        />
        <MetricCard
          icon={Activity}
          value={data.engagement.totalEvents.toLocaleString("vi-VN")}
          label="Lượt tương tác"
          note="Tổng hành động được ghi nhận trong 30 ngày"
          change={data.engagement.eventsChange}
        />
        <MetricCard
          icon={QrCode}
          value={data.productivity.qrCreated.toLocaleString("vi-VN")}
          label="QR đã tạo"
          note="Nội dung QR được người dùng lưu"
          change={data.productivity.qrChange}
        />
        <MetricCard
          icon={HardDrive}
          value={formatBytes(data.productivity.bytesFreed)}
          label="Dung lượng giải phóng"
          note={`${data.productivity.removedItems.toLocaleString("vi-VN")} mục trong ${data.productivity.cleanups.toLocaleString("vi-VN")} lượt dọn`}
          change={data.productivity.cleanupChange}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CompactMetric
          label="Tài khoản Pro"
          value={data.audience.activeSubscriptions.toLocaleString("vi-VN")}
          note={`${data.audience.proConversion}% tổng người dùng`}
        />
        <CompactMetric
          label="Media đã quét"
          value={data.media.scannedAssets.toLocaleString("vi-VN")}
          note={`${data.media.scans.toLocaleString("vi-VN")} lượt quét`}
        />
        <CompactMetric
          label="Ảnh tương tự"
          value={data.media.duplicates.toLocaleString("vi-VN")}
          note={`${data.media.screenshots.toLocaleString("vi-VN")} screenshot`}
        />
        <CompactMetric
          label="Video lớn"
          value={data.media.largeVideos.toLocaleString("vi-VN")}
          note={`${data.media.videos.toLocaleString("vi-VN")} video đã phân tích`}
        />
      </div>

      <DashboardAnalytics data={data} />
    </div>
  );
}

function CompactMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-4">
      <p className="text-xs font-bold uppercase tracking-[.08em] text-[var(--ink-muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-[-.03em] tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-[var(--ink-muted)]">{note}</p>
    </div>
  );
}
