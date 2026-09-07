"use client";

import { Cloud, Database, Files, FolderArchive, HardDrive, type LucideIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SeraSectionTitle, SeraSurface } from "@/components/sera/surface";
import type { Overview } from "@/lib/backend";

const eventLabels: Record<string, string> = {
  app_open: "Mở ứng dụng",
  qr_created: "Tạo QR",
  qr_scanned: "Quét QR",
  media_scan: "Quét thư viện",
  media_cleanup: "Dọn media",
  paywall_view: "Xem gói Pro",
};

const platformLabels: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  unknown: "Chưa xác định",
};

const platformColors = ["var(--brand)", "var(--accent)", "var(--ink-muted)", "var(--warning)"];
const taskLabels: Record<string, string> = {
  qrCreated: "QR đã tạo",
  mediaScans: "Quét media",
  cleanups: "Dọn dẹp",
};

function shortDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function chartValue(value: unknown) {
  return Number(value ?? 0).toLocaleString("vi-VN");
}

function formatBytes(value: number) {
  if (value >= 1_099_511_627_776) return `${(value / 1_099_511_627_776).toFixed(1)} TB`;
  if (value >= 1_073_741_824) return `${(value / 1_073_741_824).toFixed(1)} GB`;
  if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value.toLocaleString("vi-VN")} B`;
}

function formatDecimalGb(value: number) {
  const gigabytes = value / 1_000_000_000;
  if (value > 0 && gigabytes < 0.001) return "< 0,001 GB";
  return `${gigabytes.toLocaleString("vi-VN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} GB`;
}

function formatMeasuredAt(value: string | null) {
  if (!value) return "Chưa có thời điểm đo trực tiếp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có thời điểm đo trực tiếp";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function EmptyChart({ message }: { message: string }) {
  return <div className="grid h-72 place-items-center text-center text-sm text-[var(--ink-muted)]">{message}</div>;
}

export function DashboardAnalytics({ data }: { data: Overview }) {
  const hasUsageTrend = data.trend.some((point) => point.events || point.newUsers);
  const hasTaskTrend = data.trend.some((point) => point.qrCreated || point.cleanups || point.mediaScans);
  const eventMax = Math.max(...data.engagement.events.map((event) => event.count), 1);
  const platformTotal = data.engagement.platforms.reduce((total, item) => total + item.count, 0);
  const duplicateRate = data.media.scannedAssets
    ? Math.round((data.media.duplicates / data.media.scannedAssets) * 1000) / 10
    : 0;

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <SeraSurface className="min-w-0 p-5 sm:p-6">
          <SeraSectionTitle eyebrow="Xu hướng 30 ngày" title="Mức độ sử dụng theo ngày" />
          {hasUsageTrend ? (
            <div
              className="mt-6 h-80 min-w-0"
              role="img"
              aria-label={`Biểu đồ hoạt động 30 ngày: ${data.engagement.totalEvents} sự kiện và ${data.audience.newUsers} người dùng mới.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="event-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    labelFormatter={(label) => `Ngày ${shortDate(String(label))}`}
                    formatter={(value, name) => [chartValue(value), name === "events" ? "Sự kiện" : "Người dùng mới"]}
                    contentStyle={{
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      background: "var(--surface)",
                      color: "var(--ink)",
                    }}
                  />
                  <Legend formatter={(value) => (value === "events" ? "Sự kiện" : "Người dùng mới")} />
                  <Area
                    type="monotone"
                    dataKey="events"
                    stroke="var(--brand)"
                    strokeWidth={2.5}
                    fill="url(#event-area)"
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="newUsers"
                    stroke="var(--warning)"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    fill="transparent"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Chưa có hoạt động trong giai đoạn này." />
          )}
        </SeraSurface>

        <SeraSurface className="p-5 sm:p-6">
          <SeraSectionTitle eyebrow="Nền tảng" title="Thiết bị đang sử dụng" />
          {platformTotal ? (
            <>
              <div
                className="mt-4 h-52"
                role="img"
                aria-label={`Phân bổ ${platformTotal} sự kiện theo nền tảng.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.engagement.platforms}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={78}
                      paddingAngle={3}
                      stroke="var(--surface)"
                      strokeWidth={3}
                      isAnimationActive={false}
                    >
                      {data.engagement.platforms.map((item, index) => (
                        <Cell key={item.name} fill={platformColors[index % platformColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => chartValue(value)}
                      labelFormatter={(label) => platformLabels[String(label)] ?? String(label)}
                      contentStyle={{
                        border: "1px solid var(--line)",
                        borderRadius: 14,
                        background: "var(--surface)",
                        color: "var(--ink)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="grid gap-3 text-sm">
                {data.engagement.platforms.map((item, index) => (
                  <li key={item.name} className="flex items-center gap-3">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: platformColors[index % platformColors.length] }}
                    />
                    <span className="flex-1 text-[var(--ink-muted)]">
                      {platformLabels[item.name] ?? item.name}
                    </span>
                    <strong className="tabular-nums">
                      {item.count.toLocaleString("vi-VN")} · {Math.round((item.count / platformTotal) * 100)}%
                    </strong>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyChart message="Chưa nhận được thông tin nền tảng." />
          )}
        </SeraSurface>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <SeraSurface className="min-w-0 p-5 sm:p-6">
          <SeraSectionTitle eyebrow="Tác vụ" title="QR, quét và dọn dẹp" />
          {hasTaskTrend ? (
            <div
              className="mt-6 h-72 min-w-0"
              role="img"
              aria-label={`Biểu đồ tác vụ gồm ${data.productivity.qrCreated} QR, ${data.media.scans} lượt quét media và ${data.productivity.cleanups} lượt dọn dẹp.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    labelFormatter={(label) => `Ngày ${shortDate(String(label))}`}
                    formatter={(value, name) => {
                      return [chartValue(value), taskLabels[String(name)] ?? String(name)];
                    }}
                    contentStyle={{
                      border: "1px solid var(--line)",
                      borderRadius: 14,
                      background: "var(--surface)",
                      color: "var(--ink)",
                    }}
                  />
                  <Legend formatter={(value) => taskLabels[String(value)] ?? String(value)} />
                  <Bar dataKey="qrCreated" fill="var(--brand)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="mediaScans" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="cleanups" fill="var(--warning)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyChart message="Chưa có tác vụ để phân tích." />
          )}
        </SeraSurface>

        <SeraSurface className="p-5 sm:p-6">
          <SeraSectionTitle eyebrow="Tín hiệu sử dụng" title="Hành động phổ biến" />
          <div className="mt-6 grid gap-4">
            {data.engagement.events.length ? (
              data.engagement.events.map((event) => (
                <div key={event.name}>
                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                    <span className="truncate text-[var(--ink-muted)]">
                      {eventLabels[event.name] ?? event.name.replaceAll("_", " ")}
                    </span>
                    <strong className="tabular-nums">{event.count.toLocaleString("vi-VN")}</strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-raised)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand)]"
                      style={{ width: `${Math.max(4, (event.count / eventMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="py-10 text-center text-sm text-[var(--ink-muted)]">Chưa có sự kiện sử dụng.</p>
            )}
          </div>
        </SeraSurface>
      </div>

      {data.storage ? (
        <>
          <ServerStorage storage={data.storage} />
          {data.storage.r2 && <R2StorageUsage storage={data.storage} r2={data.storage.r2} />}
        </>
      ) : (
        <SeraSurface className="p-5 sm:p-6">
          <SeraSectionTitle eyebrow="Hạ tầng" title="Dung lượng server" />
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200" role="status">
            Máy chủ chưa trả về thống kê ổ đĩa. Dung lượng sẽ xuất hiện khi máy chủ cung cấp dữ liệu này.
          </div>
        </SeraSurface>
      )}

      <SeraSurface className="p-5 sm:p-6">
        <SeraSectionTitle eyebrow="Chất lượng vận hành" title="Hiệu quả quét media" />
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <OperationalMetric
            label="Preview sẵn sàng"
            value={`${data.media.previewCoverage}%`}
            detail={`${data.media.previewReadyAssets.toLocaleString("vi-VN")} / ${data.media.totalPreviewAssets.toLocaleString("vi-VN")} media`}
            progress={data.media.previewCoverage}
          />
          <OperationalMetric
            label="Tỷ lệ media tương tự"
            value={`${duplicateRate}%`}
            detail={`${data.media.duplicates.toLocaleString("vi-VN")} trong ${data.media.scannedAssets.toLocaleString("vi-VN")} mục đã quét`}
            progress={duplicateRate}
          />
          <OperationalMetric
            label="Thời gian quét trung bình"
            value={`${data.media.averageScanSeconds}s`}
            detail={`${data.media.scans.toLocaleString("vi-VN")} lượt quét trong 30 ngày`}
          />
        </div>
      </SeraSurface>

      <details className="rounded-2xl border bg-[var(--surface)] p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Xem bảng dữ liệu 30 ngày</summary>
        <div className="mt-4 overflow-x-auto">
          <table className="data-table min-w-[720px]">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Sự kiện</th>
                <th>Người dùng mới</th>
                <th>QR</th>
                <th>Quét media</th>
                <th>Dọn dẹp</th>
              </tr>
            </thead>
            <tbody>
              {data.trend.map((point) => (
                <tr key={point.date}>
                  <td>{shortDate(point.date)}</td>
                  <td>{point.events.toLocaleString("vi-VN")}</td>
                  <td>{point.newUsers.toLocaleString("vi-VN")}</td>
                  <td>{point.qrCreated.toLocaleString("vi-VN")}</td>
                  <td>{point.mediaScans.toLocaleString("vi-VN")}</td>
                  <td>{point.cleanups.toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function R2StorageUsage({
  storage,
  r2,
}: {
  storage: NonNullable<Overview["storage"]>;
  r2: NonNullable<NonNullable<Overview["storage"]>["r2"]>;
}) {
  const isBucketSnapshot = r2.source === "bucket";
  const difference = r2.usedBytes - storage.previewBytes;

  return (
    <SeraSurface className="overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SeraSectionTitle eyebrow="Object storage" title="Dung lượng Cloudflare R2" />
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ink-muted)]">
            Tổng dung lượng object media trong bucket, được đo độc lập với ổ đĩa server.
          </p>
        </div>
        <span
          className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-bold ${
            isBucketSnapshot
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "bg-amber-500/10 text-amber-800 dark:text-amber-200"
          }`}
          role="status"
        >
          {isBucketSnapshot ? "Đo trực tiếp từ R2" : "Tạm tính từ database"}
        </span>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl bg-[var(--surface-raised)] p-5 sm:p-6">
          <div className="flex items-center gap-3 text-[var(--brand)]">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--surface)]">
              <Cloud size={21} aria-hidden="true" />
            </span>
            <p className="text-sm font-bold uppercase tracking-[.08em]">Đã sử dụng trên R2</p>
          </div>
          <p className="mt-6 text-4xl font-semibold tracking-[-.055em] tabular-nums sm:text-5xl">
            {formatDecimalGb(r2.usedBytes)}
          </p>
          <p className="mt-2 text-sm tabular-nums text-[var(--ink-muted)]">
            {formatBytes(r2.usedBytes)} · {r2.usedBytes.toLocaleString("vi-VN")} byte
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <StorageMetric
            icon={Files}
            label="Số object"
            value={r2.objectCount === null ? "Chưa xác định" : r2.objectCount.toLocaleString("vi-VN")}
            detail={isBucketSnapshot ? "Đếm trực tiếp trong prefix media" : "Cần quyền ListObjects để đo"}
          />
          <StorageMetric
            icon={Database}
            label="Media trong database"
            value={formatBytes(storage.previewBytes)}
            detail={
              isBucketSnapshot
                ? `Chênh lệch với R2: ${difference >= 0 ? "+" : "−"}${formatBytes(Math.abs(difference))}`
                : "Số liệu đang dùng để dự phòng"
            }
          />
        </div>
      </div>

      <dl className="mt-5 grid gap-4 rounded-2xl border bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] p-4 text-sm md:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs font-semibold text-[var(--ink-muted)]">Bucket</dt>
          <dd className="mt-1 truncate font-mono font-semibold" title={r2.bucket}>{r2.bucket || "Chưa cấu hình"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-semibold text-[var(--ink-muted)]">Prefix được thống kê</dt>
          <dd className="mt-1 truncate font-mono font-semibold" title={r2.prefix}>{r2.prefix || "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-semibold text-[var(--ink-muted)]">Cập nhật lần cuối</dt>
          <dd className="mt-1 font-semibold tabular-nums">{formatMeasuredAt(r2.measuredAt)}</dd>
        </div>
      </dl>

      {!isBucketSnapshot && (
        <p className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200" role="status">
          Backend chưa đọc được danh sách object từ R2. Dung lượng phía trên đang lấy từ metadata media trong database và sẽ tự chuyển sang số liệu bucket khi kết nối hoạt động lại.
        </p>
      )}
    </SeraSurface>
  );
}

function ServerStorage({ storage }: { storage: NonNullable<Overview["storage"]> }) {
  const usage = Math.min(100, Math.max(0, storage.usedPercent));
  const status = usage >= 90 ? "Nguy cấp" : usage >= 80 ? "Cần theo dõi" : "Ổn định";
  const statusColor = usage >= 90 ? "var(--danger)" : usage >= 80 ? "var(--warning)" : "var(--brand)";

  return (
    <SeraSurface className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SeraSectionTitle eyebrow="Hạ tầng" title="Dung lượng server" />
          <p className="mt-2 text-xs font-semibold text-[var(--ink-muted)]">
            Nguồn dữ liệu: {storage.sourceHost ?? "máy chủ hiện tại"}
          </p>
        </div>
        <span
          className="inline-flex min-h-8 items-center rounded-full px-3 text-xs font-bold"
          style={{
            color: statusColor,
            backgroundColor: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
          }}
        >
          {status}
        </span>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_.8fr] xl:items-end">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--ink-muted)]">Ổ đĩa đã sử dụng</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-.05em] tabular-nums">
                {formatBytes(storage.usedBytes)}
                <span className="ml-2 text-base font-medium tracking-normal text-[var(--ink-muted)]">
                  / {formatBytes(storage.totalBytes)}
                </span>
              </p>
            </div>
            <strong className="text-2xl tabular-nums" style={{ color: statusColor }}>
              {storage.usedPercent}%
            </strong>
          </div>
          <div
            className="mt-5 h-3 overflow-hidden rounded-full bg-[var(--surface-raised)]"
            role="progressbar"
            aria-label="Dung lượng ổ đĩa server đã sử dụng"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={usage}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${usage}%`, backgroundColor: statusColor }}
            />
          </div>
          <div className="mt-3 flex justify-between gap-4 text-xs text-[var(--ink-muted)]">
            <span>Đã dùng {formatBytes(storage.usedBytes)}</span>
            <span>Còn trống {formatBytes(storage.freeBytes)}</span>
          </div>
        </div>

        <p className="rounded-2xl bg-[var(--surface-raised)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
          Ổ đĩa được đo trực tiếp trên server {storage.sourceHost ?? "máy chủ hiện tại"}. Media đồng bộ được quản lý bởi {storage.mediaProvider ?? "ổ đĩa server"}; số liệu bên dưới đã loại trừ object trùng lặp.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StorageMetric
          icon={HardDrive}
          label="Còn trống"
          value={formatBytes(storage.freeBytes)}
          detail={`${Math.max(0, 100 - storage.usedPercent).toFixed(1)}% tổng dung lượng`}
        />
        <StorageMetric
          icon={Database}
          label="PostgreSQL"
          value={formatBytes(storage.databaseBytes)}
          detail="Database hiện tại"
        />
        <StorageMetric
          icon={FolderArchive}
          label="Media object"
          value={formatBytes(storage.previewBytes)}
          detail={storage.mediaProvider ?? "Ổ đĩa server"}
        />
      </div>
    </SeraSurface>
  );
}

function StorageMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-raised)] text-[var(--brand)]">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[var(--ink-muted)]">{label}</p>
        <p className="mt-1 truncate text-lg font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{detail}</p>
      </div>
    </div>
  );
}

function OperationalMetric({
  label,
  value,
  detail,
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  progress?: number;
}) {
  return (
    <div className="rounded-2xl bg-[var(--surface-raised)] p-4">
      <p className="text-xs font-bold uppercase tracking-[.08em] text-[var(--ink-muted)]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-.04em] tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{detail}</p>
      {progress !== undefined && (
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.max(0, progress))}
        >
          <div
            className="h-full rounded-full bg-[var(--brand)]"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
