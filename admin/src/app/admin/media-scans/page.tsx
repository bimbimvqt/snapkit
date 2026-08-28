import Image from "next/image";
import { Clock3, Copy, Film, HardDrive, Image as ImageIcon, Images, MonitorSmartphone } from "lucide-react";
import { MetricCard } from "@/components/admin/metric-card";
import { Badge } from "@/components/ui/badge";
import { SeraSectionTitle, SeraSurface } from "@/components/sera/surface";
import { backendFetch, type MediaScanAnalytics, type MediaScanAsset } from "@/lib/backend";

const categoryLabels = {
  SIMILAR: "Tương tự",
  SCREENSHOT: "Screenshot",
  LARGE_VIDEO: "Video lớn",
  OTHER: "Đã quét",
} as const;

function formatBytes(value: number) {
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function AssetPreview({ asset }: { asset: MediaScanAsset }) {
  return (
    <article className="group overflow-hidden rounded-2xl border bg-[var(--surface-raised)]">
      <div className="relative aspect-square overflow-hidden bg-[var(--surface)]">
        {asset.hasThumbnail ? (
          <Image
            src={`/backend/api/admin/media-scans/assets/${asset.id}/thumbnail`}
            alt={asset.type === "VIDEO" ? "Thumbnail video đã quét" : "Thumbnail ảnh đã quét"}
            fill
            unoptimized
            sizes="(max-width: 640px) 33vw, (max-width: 1280px) 20vw, 160px"
            className="object-cover transition duration-300 group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <span className="grid size-full place-items-center text-[var(--ink-muted)]">
            {asset.type === "VIDEO" ? <Film size={28} /> : <ImageIcon size={28} />}
          </span>
        )}
        <span className="absolute left-2 top-2 grid size-8 place-items-center rounded-xl bg-black/65 text-white backdrop-blur-sm">
          {asset.type === "VIDEO" ? <Film size={15} /> : <ImageIcon size={15} />}
        </span>
        {asset.durationSeconds !== null && (
          <span className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-bold text-white">
            {Math.floor(asset.durationSeconds / 60)}:{String(asset.durationSeconds % 60).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex flex-wrap gap-1.5">
          {asset.categories.map((category) => (
            <Badge key={category} size="xs" className={category === "SIMILAR" ? "bg-violet-500/15 text-violet-300" : "bg-[var(--surface)] text-[var(--ink-muted)]"}>
              {categoryLabels[category]}
            </Badge>
          ))}
        </div>
        <p className="mt-2 truncate text-[11px] text-[var(--ink-muted)]">{asset.width}×{asset.height} · {formatBytes(asset.bytes)}</p>
      </div>
    </article>
  );
}

export default async function MediaScansPage() {
  const data = await backendFetch<MediaScanAnalytics>("/api/admin/media-scans");
  return (
    <div className="grid gap-7">
      <header>
        <p className="label">Media observability</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Media đã quét</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
          Theo dõi thumbnail nén và metadata từ các lượt quét gần nhất. Hệ thống không nhận file gốc hoặc tên file trong thư viện.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={MonitorSmartphone} value={data.totalScans.toLocaleString("vi-VN")} label="Lượt quét" note="Tất cả thời gian" />
        <MetricCard icon={Images} value={data.totalAssets.toLocaleString("vi-VN")} label="Media đồng bộ" note="Thumbnail + metadata" />
        <MetricCard icon={Copy} value={data.duplicateAssets.toLocaleString("vi-VN")} label="Ảnh tương tự" note="Được app phát hiện" />
      </div>

      {data.latest.length === 0 ? (
        <SeraSurface className="grid min-h-72 place-items-center p-8 text-center">
          <div><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--surface-raised)] text-[var(--brand)]"><Images size={25} /></span><h2 className="mt-4 text-lg font-bold">Chưa có lượt quét nào</h2><p className="mt-2 text-sm text-[var(--ink-muted)]">Dữ liệu sẽ xuất hiện sau khi app hoàn tất quét và đồng bộ.</p></div>
        </SeraSurface>
      ) : (
        <div className="grid gap-5">
          {data.latest.map((scan, index) => (
            <SeraSurface key={scan.id} className="overflow-hidden">
              <details open={index === 0}>
                <summary className="cursor-pointer list-none p-5 transition hover:bg-[var(--surface-raised)] sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><strong>{scan.user?.email ?? scan.user?.name ?? "Thiết bị ẩn danh"}</strong><Badge size="xs" className="bg-[var(--surface-raised)] text-[var(--ink-muted)]">{scan.deviceId}</Badge></div>
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-muted)]"><span className="inline-flex items-center gap-1.5"><Clock3 size={13} />{new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(scan.createdAt))}</span><span>{(scan.durationMs / 1000).toFixed(1)} giây</span></p>
                    </div>
                    <div className="flex flex-wrap gap-2"><Badge size="sm" iconLeft={<ImageIcon size={13} />}>{scan.imageCount} ảnh</Badge><Badge size="sm" iconLeft={<Film size={13} />}>{scan.videoCount} video</Badge><Badge size="sm" iconLeft={<HardDrive size={13} />}>{scan._count.assets}/{scan.scannedCount} đã đồng bộ</Badge></div>
                  </div>
                </summary>
                <div className="border-t p-5 sm:p-6">
                  <SeraSectionTitle eyebrow="Scan result" title={`${scan.duplicateCount} ảnh tương tự · ${scan.screenshotCount} screenshot · ${scan.largeVideoCount} video lớn`} />
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
                    {scan.assets.map((asset) => <AssetPreview key={asset.id} asset={asset} />)}
                  </div>
                  {scan._count.assets > scan.assets.length && <p className="mt-4 text-xs text-[var(--ink-muted)]">Đang hiển thị 120 media đầu tiên của lượt quét này.</p>}
                </div>
              </details>
            </SeraSurface>
          ))}
        </div>
      )}
    </div>
  );
}
