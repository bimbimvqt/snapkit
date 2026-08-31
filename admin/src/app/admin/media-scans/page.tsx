import Link from "next/link";
import { ChevronLeft, ChevronRight, Copy, Film, Image as ImageIcon, Images, MonitorSmartphone, Smartphone, UserRound } from "lucide-react";
import { MetricCard } from "@/components/admin/metric-card";
import { Badge } from "@/components/ui/badge";
import { SeraSectionTitle, SeraSurface } from "@/components/sera/surface";
import { backendFetch } from "@/lib/backend";
import { normalizeMediaScanAnalytics } from "@/lib/media-scans";
import { MediaGallery } from "./media-gallery";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageNumbers(current: number, total: number) {
  const values = new Set([1, total, current - 1, current, current + 1]);
  return [...values].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
}

function hrefFor(input: { group?: string | null; type?: string; page?: number }) {
  const params = new URLSearchParams();
  if (input.group) params.set("group", input.group);
  if (input.type && input.type !== "ALL") params.set("type", input.type);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/admin/media-scans?${query}` : "/admin/media-scans";
}

export default async function MediaScansPage({ searchParams }: { searchParams: SearchParams }) {
  const rawParams = await searchParams;
  const query = new URLSearchParams();
  const group = first(rawParams.group);
  const type = first(rawParams.type);
  const page = first(rawParams.page);
  if (group) query.set("group", group);
  if (type) query.set("type", type);
  if (page) query.set("page", page);

  const data = normalizeMediaScanAnalytics(
    await backendFetch<unknown>(`/api/admin/media-scans?${query.toString()}`),
    { group, type, page: page ? Number(page) : undefined },
  );
  const selectedGroup = data.groups.find((item) => item.key === data.selectedGroupKey) ?? null;
  const rangeStart = data.assets.total === 0 ? 0 : (data.assets.page - 1) * data.assets.pageSize + 1;
  const rangeEnd = Math.min(data.assets.page * data.assets.pageSize, data.assets.total);
  const pages = pageNumbers(data.assets.page, data.assets.totalPages);

  return (
    <div className="grid gap-7">
      <header>
        <p className="label">Media observability</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Media đã quét</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--ink-muted)]">
          Mỗi người dùng chỉ xuất hiện một lần. Media trùng giữa nhiều lượt quét được hợp nhất theo ID trên thiết bị.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={MonitorSmartphone} value={data.totalScans.toLocaleString("vi-VN")} label="Lượt quét" note="Tất cả thời gian" />
        <MetricCard icon={Images} value={data.totalAssets.toLocaleString("vi-VN")} label="Media duy nhất" note="Đã khử trùng lặp" />
        <MetricCard icon={Copy} value={data.duplicateAssets.toLocaleString("vi-VN")} label="Media tương tự" note="Do ứng dụng phát hiện" />
      </div>

      {data.groups.length === 0 ? (
        <SeraSurface className="grid min-h-72 place-items-center p-8 text-center">
          <div>
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--surface-raised)] text-[var(--brand)]"><Images size={25} aria-hidden="true" /></span>
            <h2 className="mt-4 text-lg font-bold">Chưa có lượt quét nào</h2>
            <p className="mt-2 text-sm text-[var(--ink-muted)]">Dữ liệu sẽ xuất hiện sau khi app hoàn tất quét và đồng bộ.</p>
          </div>
        </SeraSurface>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
          <SeraSurface className="overflow-hidden xl:sticky xl:top-6">
            <div className="border-b p-5">
              <SeraSectionTitle eyebrow="Đã hợp nhất" title={`${data.groups.length} người dùng / thiết bị`} />
            </div>
            <nav aria-label="Chọn người dùng" className="grid max-h-[32rem] gap-2 overflow-y-auto p-3 xl:max-h-[calc(100vh-12rem)]">
              {data.groups.map((item) => {
                const selected = item.key === data.selectedGroupKey;
                const identity = item.user?.email ?? item.user?.name ?? `Thiết bị ${item.deviceId}`;
                return (
                  <Link
                    key={item.key}
                    href={hrefFor({ group: item.key, type: data.assets.type, page: 1 })}
                    aria-current={selected ? "page" : undefined}
                    className={`min-h-24 cursor-pointer rounded-2xl border p-4 transition duration-200 ${selected ? "border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface))] shadow-sm" : "bg-[var(--surface)] hover:bg-[var(--surface-raised)]"}`}
                  >
                    <span className="flex items-start gap-3">
                      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-[var(--brand)] text-white" : "bg-[var(--surface-raised)] text-[var(--ink-muted)]"}`}>
                        {item.user ? <UserRound size={18} aria-hidden="true" /> : <Smartphone size={18} aria-hidden="true" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{identity}</strong>
                        <span className="mt-1 block text-xs text-[var(--ink-muted)]">
                          {item.assetCount.toLocaleString("vi-VN")} media · {item.scanCount} lượt quét
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          <Badge size="xs" className="bg-[var(--surface-raised)] text-[var(--ink-muted)]">{item.imageCount} ảnh</Badge>
                          <Badge size="xs" className="bg-[var(--surface-raised)] text-[var(--ink-muted)]">{item.videoCount} video</Badge>
                        </span>
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </SeraSurface>

          <SeraSurface className="min-w-0 overflow-hidden">
            <div className="border-b p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="label">Thư viện đã hợp nhất</p>
                  <h2 className="mt-2 truncate text-xl font-semibold tracking-tight">
                    {selectedGroup?.user?.email ?? selectedGroup?.user?.name ?? `Thiết bị ${selectedGroup?.deviceId}`}
                  </h2>
                  <p className="mt-2 text-xs text-[var(--ink-muted)]">
                    {selectedGroup?.scanCount} lượt quét · {selectedGroup?.deviceCount} thiết bị · cập nhật {selectedGroup ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(selectedGroup.latestScanAt)) : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc loại media">
                  {([
                    ["ALL", "Tất cả", Images],
                    ["IMAGE", "Ảnh", ImageIcon],
                    ["VIDEO", "Video", Film],
                  ] as const).map(([value, label, Icon]) => {
                    const active = data.assets.type === value;
                    return (
                      <Link
                        key={value}
                        href={hrefFor({ group: data.selectedGroupKey, type: value, page: 1 })}
                        aria-current={active ? "page" : undefined}
                        className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition duration-200 ${active ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "bg-[var(--surface)] hover:bg-[var(--surface-raised)]"}`}
                      >
                        <Icon size={16} aria-hidden="true" />{label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {data.assets.items.length > 0 ? (
                <MediaGallery key={data.assets.items.map((asset) => asset.id).join(":")} assets={data.assets.items} />
              ) : (
                <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed bg-[var(--surface-raised)] p-6 text-center">
                  <div>
                    <Images className="mx-auto text-[var(--ink-muted)]" size={30} aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold">Không có media trong bộ lọc này</p>
                  </div>
                </div>
              )}
            </div>

            <footer className="flex flex-col gap-4 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-[var(--ink-muted)]" aria-live="polite">
                Hiển thị {rangeStart.toLocaleString("vi-VN")}–{rangeEnd.toLocaleString("vi-VN")} / {data.assets.total.toLocaleString("vi-VN")}
              </p>
              {data.assets.totalPages > 1 && (
                <nav aria-label="Phân trang media" className="flex flex-wrap items-center gap-1.5">
                  {data.assets.page > 1 ? (
                    <Link href={hrefFor({ group: data.selectedGroupKey, type: data.assets.type, page: data.assets.page - 1 })} className="grid size-11 cursor-pointer place-items-center rounded-xl border transition duration-200 hover:bg-[var(--surface-raised)]" aria-label="Trang trước"><ChevronLeft size={18} aria-hidden="true" /></Link>
                  ) : (
                    <span className="grid size-11 place-items-center rounded-xl border opacity-40" aria-hidden="true"><ChevronLeft size={18} /></span>
                  )}
                  {pages.map((pageNumber, index) => (
                    <span key={pageNumber} className="contents">
                      {index > 0 && pageNumber - pages[index - 1] > 1 && <span className="grid size-8 place-items-center text-[var(--ink-muted)]" aria-hidden="true">…</span>}
                      <Link href={hrefFor({ group: data.selectedGroupKey, type: data.assets.type, page: pageNumber })} aria-current={pageNumber === data.assets.page ? "page" : undefined} className={`grid size-11 cursor-pointer place-items-center rounded-xl border text-sm font-semibold transition duration-200 ${pageNumber === data.assets.page ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "hover:bg-[var(--surface-raised)]"}`}>
                        {pageNumber}
                      </Link>
                    </span>
                  ))}
                  {data.assets.page < data.assets.totalPages ? (
                    <Link href={hrefFor({ group: data.selectedGroupKey, type: data.assets.type, page: data.assets.page + 1 })} className="grid size-11 cursor-pointer place-items-center rounded-xl border transition duration-200 hover:bg-[var(--surface-raised)]" aria-label="Trang tiếp theo"><ChevronRight size={18} aria-hidden="true" /></Link>
                  ) : (
                    <span className="grid size-11 place-items-center rounded-xl border opacity-40" aria-hidden="true"><ChevronRight size={18} /></span>
                  )}
                </nav>
              )}
            </footer>
          </SeraSurface>
        </div>
      )}
    </div>
  );
}
