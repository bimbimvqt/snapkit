"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Gauge,
  Image as ImageIcon,
  LoaderCircle,
  Maximize,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MediaScanAsset } from "@/lib/backend";

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

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function thumbnailUrl(asset: MediaScanAsset, download = false) {
  return `/backend/api/admin/media-scans/assets/${asset.id}/thumbnail${download ? "?download=1" : ""}`;
}

function previewUrl(asset: MediaScanAsset, download = false) {
  return `/backend/api/admin/media-scans/assets/${asset.id}/preview${download ? "?download=1" : ""}`;
}

function downloadUrl(asset: MediaScanAsset) {
  return asset.hasOriginal
    ? `/backend/api/admin/media-scans/assets/${asset.id}/download`
    : previewUrl(asset, true);
}

function AdminVideoPlayer({ asset }: { asset: MediaScanAsset }) {
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(asset.durationSeconds ?? 0);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);
  const [buffering, setBuffering] = useState(false);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) await video.play().catch(() => setFailed(true));
    else video.pause();
  }

  function seekBy(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.duration || duration, Math.max(0, video.currentTime + seconds));
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seconds;
    setCurrentTime(seconds);
  }

  async function enterFullscreen() {
    await playerRef.current?.requestFullscreen?.();
  }

  return (
    <div
      ref={playerRef}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === " " || event.key.toLowerCase() === "k") {
          event.preventDefault();
          void togglePlayback();
        }
        if (event.key === "ArrowLeft") seekBy(-5);
        if (event.key === "ArrowRight") seekBy(5);
        if (event.key.toLowerCase() === "m") {
          const video = videoRef.current;
          if (video) video.muted = !video.muted;
        }
        if (event.key.toLowerCase() === "f") void enterFullscreen();
      }}
      className="group/player relative flex h-[min(72vh,46rem)] min-h-64 w-full items-center justify-center overflow-hidden bg-[#07100e] outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[var(--brand)]"
      aria-label="Trình phát video preview"
    >
      <video
        ref={videoRef}
        className="size-full object-contain"
        poster={asset.hasThumbnail ? thumbnailUrl(asset) : undefined}
        preload="metadata"
        playsInline
        onClick={() => void togglePlayback()}
        onPlay={() => setPlaying(true)}
        onPlaying={() => setBuffering(false)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || asset.durationSeconds || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted || event.currentTarget.volume === 0)}
        onError={() => setFailed(true)}
      >
        <source src={previewUrl(asset)} type={asset.previewMimeType ?? undefined} />
      </video>

      {!playing && !failed && (
        <button type="button" onClick={() => void togglePlayback()} className="absolute grid size-16 cursor-pointer place-items-center rounded-full bg-black/70 text-white shadow-xl backdrop-blur-sm transition duration-200 hover:bg-black/90" aria-label="Phát video">
          <Play className="translate-x-0.5" size={28} fill="currentColor" aria-hidden="true" />
        </button>
      )}

      {buffering && !failed && (
        <div className="pointer-events-none absolute grid size-14 place-items-center rounded-full bg-black/70 text-white backdrop-blur-sm" role="status" aria-label="Đang tải video">
          <LoaderCircle className="animate-spin motion-reduce:animate-none" size={26} aria-hidden="true" />
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 grid place-items-center bg-[#07100e]/95 p-6 text-center text-white" role="alert">
          <div>
            <Film className="mx-auto text-white/60" size={40} aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold">Trình duyệt không phát được định dạng video này</p>
            <p className="mt-1 text-xs text-white/60">Bạn vẫn có thể tải file gốc bằng nút Tải xuống.</p>
          </div>
        </div>
      )}

      {!failed && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/65 to-transparent px-3 pb-3 pt-12 text-white opacity-100 transition duration-200 sm:px-5">
          <label className="block cursor-pointer" aria-label="Tiến trình video">
            <input
              type="range"
              min={0}
              max={Math.max(1, duration)}
              step="0.1"
              value={Math.min(currentTime, Math.max(1, duration))}
              onChange={(event) => seekTo(Number(event.target.value))}
              className="h-6 w-full cursor-pointer accent-[var(--accent)]"
              aria-label="Tua video"
            />
          </label>
          <div className="flex items-center gap-1 sm:gap-2">
            <button type="button" onClick={() => void togglePlayback()} className="grid size-11 cursor-pointer place-items-center rounded-xl transition duration-200 hover:bg-white/15" aria-label={playing ? "Tạm dừng" : "Phát video"}>
              {playing ? <Pause size={21} fill="currentColor" aria-hidden="true" /> : <Play size={21} fill="currentColor" aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => seekBy(-10)} className="hidden size-11 cursor-pointer place-items-center rounded-xl transition duration-200 hover:bg-white/15 sm:grid" aria-label="Lùi 10 giây"><RotateCcw size={19} aria-hidden="true" /></button>
            <button type="button" onClick={() => seekBy(10)} className="hidden size-11 cursor-pointer place-items-center rounded-xl transition duration-200 hover:bg-white/15 sm:grid" aria-label="Tiến 10 giây"><RotateCw size={19} aria-hidden="true" /></button>
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (video) video.muted = !video.muted;
              }}
              className="grid size-11 cursor-pointer place-items-center rounded-xl transition duration-200 hover:bg-white/15"
              aria-label={muted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
            </button>
            <span className="min-w-24 text-xs font-semibold tabular-nums">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
            <span className="flex-1" />
            <label className="hidden min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 hover:bg-white/15 sm:flex">
              <Gauge size={18} aria-hidden="true" />
              <select
                value={speed}
                onChange={(event) => {
                  const nextSpeed = Number(event.target.value);
                  setSpeed(nextSpeed);
                  if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
                }}
                className="cursor-pointer bg-transparent text-sm font-semibold outline-none"
                aria-label="Tốc độ phát"
              >
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value} className="text-black">{value}x</option>)}
              </select>
            </label>
            <button type="button" onClick={() => void enterFullscreen()} className="grid size-11 cursor-pointer place-items-center rounded-xl transition duration-200 hover:bg-white/15" aria-label="Toàn màn hình"><Maximize size={20} aria-hidden="true" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaGallery({ assets: initialAssets }: { assets: MediaScanAsset[] }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [assets, setAssets] = useState(initialAssets);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const activeAsset = activeIndex === null ? null : assets[activeIndex];

  function openPreview(index: number) {
    setActiveIndex(index);
    dialogRef.current?.showModal();
  }

  function closePreview() {
    dialogRef.current?.close();
    setActiveIndex(null);
    setConfirmingDelete(false);
    setDeleteError("");
  }

  async function deleteActiveAsset() {
    if (!activeAsset || activeIndex === null) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const response = await fetch(`/backend/api/admin/media-scans/assets/${activeAsset.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      if (!response.ok) throw new Error(body?.error?.message ?? "Không thể xoá media");
      const nextAssets = assets.filter((asset) => asset.id !== activeAsset.id);
      setAssets(nextAssets);
      setConfirmingDelete(false);
      if (nextAssets.length === 0) closePreview();
      else setActiveIndex(Math.min(activeIndex, nextAssets.length - 1));
      router.refresh();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Không thể xoá media. Vui lòng thử lại.");
    } finally {
      setDeleting(false);
    }
  }

  function movePreview(direction: -1 | 1) {
    setActiveIndex((current) => {
      if (current === null) return null;
      return (current + direction + assets.length) % assets.length;
    });
  }

  useEffect(() => {
    if (activeIndex === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const current = assets[activeIndex];
      if (current?.type === "VIDEO" && current.hasPreview) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      setActiveIndex((current) => {
        if (current === null) return null;
        return (current + direction + assets.length) % assets.length;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, assets]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {assets.map((asset, index) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => openPreview(index)}
            className="group cursor-pointer overflow-hidden rounded-2xl border bg-[var(--surface-raised)] text-left transition duration-200 hover:border-[var(--brand)] hover:shadow-lg focus-visible:outline-offset-2"
            aria-label={`Xem trước ${asset.type === "VIDEO" ? "video" : "ảnh"} ${index + 1}`}
          >
            <span className="relative block aspect-square overflow-hidden bg-[var(--surface)]">
              {asset.hasThumbnail ? (
                <Image
                  src={thumbnailUrl(asset)}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 20vw, 220px"
                  className="object-cover transition duration-200 group-hover:brightness-90 motion-reduce:transition-none"
                />
              ) : (
                <span className="grid size-full place-items-center text-[var(--ink-muted)]">
                  {asset.type === "VIDEO" ? <Film size={30} aria-hidden="true" /> : <ImageIcon size={30} aria-hidden="true" />}
                </span>
              )}
              <span className="absolute left-2 top-2 grid size-8 place-items-center rounded-xl bg-black/70 text-white backdrop-blur-sm">
                {asset.type === "VIDEO" ? <Film size={15} aria-hidden="true" /> : <ImageIcon size={15} aria-hidden="true" />}
              </span>
              <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-xl bg-black/70 text-white opacity-0 transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                <Maximize2 size={15} aria-hidden="true" />
              </span>
              {asset.durationSeconds !== null && (
                <span className="absolute bottom-2 right-2 rounded-lg bg-black/75 px-2 py-1 text-xs font-bold text-white">
                  {formatDuration(asset.durationSeconds)}
                </span>
              )}
            </span>
            <span className="block p-3">
              <span className="flex min-h-5 flex-wrap gap-1.5">
                {asset.categories.map((category) => (
                  <Badge key={category} size="xs" className={category === "SIMILAR" ? "bg-violet-500/15 text-violet-500 dark:text-violet-300" : "bg-[var(--surface)] text-[var(--ink-muted)]"}>
                    {categoryLabels[category]}
                  </Badge>
                ))}
              </span>
              <span className="mt-2 block truncate text-xs text-[var(--ink-muted)]">
                {asset.width}×{asset.height} · {formatBytes(asset.bytes)}
              </span>
            </span>
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          if (confirmingDelete) {
            if (!deleting) {
              setConfirmingDelete(false);
              setDeleteError("");
            }
            return;
          }
          closePreview();
        }}
        onClose={() => setActiveIndex(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget && !confirmingDelete && !deleting) closePreview();
        }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(72rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border bg-[var(--surface)] p-0 text-[var(--ink)] shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm"
        aria-label="Xem trước media"
      >
        {activeAsset && (
          <div className="relative flex max-h-[calc(100dvh-2rem)] flex-col">
            <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {activeAsset.type === "VIDEO" ? "Video đã quét" : "Ảnh đã quét"}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">
                  {activeIndex! + 1}/{assets.length} · {activeAsset.width}×{activeAsset.height} · {formatBytes(activeAsset.bytes)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {(activeAsset.hasPreview || activeAsset.hasThumbnail) && (
                  <a
                    href={activeAsset.hasPreview ? downloadUrl(activeAsset) : thumbnailUrl(activeAsset, true)}
                    download
                    className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition duration-200 hover:bg-[var(--surface-raised)]"
                    aria-label={activeAsset.type === "VIDEO" && activeAsset.hasPreview ? "Tải video" : "Tải ảnh preview"}
                  >
                    <Download size={18} aria-hidden="true" />
                    <span className="hidden sm:inline">Tải xuống</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => { setDeleteError(""); setConfirmingDelete(true); }}
                  disabled={deleting}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-red-500/40 px-3 text-sm font-semibold text-red-600 transition duration-200 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
                  aria-label="Xoá media khỏi trang quản trị"
                >
                  <Trash2 size={18} aria-hidden="true" />
                  <span className="hidden sm:inline">Xoá</span>
                </button>
                <button type="button" onClick={closePreview} className="grid size-11 cursor-pointer place-items-center rounded-xl border transition duration-200 hover:bg-[var(--surface-raised)]" aria-label="Đóng preview">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </header>

            <div className="relative min-h-0 flex-1 bg-[#07100e]">
              {activeAsset.type === "VIDEO" && activeAsset.hasPreview ? (
                <AdminVideoPlayer key={activeAsset.id} asset={activeAsset} />
              ) : (
                <div className="relative h-[min(72vh,46rem)] min-h-64 w-full">
                {activeAsset.hasPreview || activeAsset.hasThumbnail ? (
                  <Image src={activeAsset.hasPreview ? previewUrl(activeAsset) : thumbnailUrl(activeAsset)} alt={activeAsset.type === "VIDEO" ? "Ảnh đại diện của video đã quét" : "Ảnh đã quét kích thước lớn"} fill unoptimized priority sizes="100vw" className="object-contain" />
                ) : (
                  <div className="grid size-full place-items-center text-white/60">
                    <div className="text-center">
                      {activeAsset.type === "VIDEO" ? <Film className="mx-auto" size={42} aria-hidden="true" /> : <ImageIcon className="mx-auto" size={42} aria-hidden="true" />}
                      <p className="mt-3 text-sm">Media này không có thumbnail</p>
                    </div>
                  </div>
                )}
              </div>
              )}

              {assets.length > 1 && (
                <>
                  <button type="button" onClick={() => movePreview(-1)} className="absolute left-3 top-1/2 grid size-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/70 text-white backdrop-blur-sm transition duration-200 hover:bg-black/90 sm:left-5" aria-label="Media trước">
                    <ChevronLeft size={24} aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => movePreview(1)} className="absolute right-3 top-1/2 grid size-12 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-black/70 text-white backdrop-blur-sm transition duration-200 hover:bg-black/90 sm:right-5" aria-label="Media tiếp theo">
                    <ChevronRight size={24} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>

            {activeAsset.type === "VIDEO" && !activeAsset.hasPreview && (
              <p className="shrink-0 border-t bg-[var(--surface-raised)] px-4 py-3 text-xs leading-5 text-[var(--ink-muted)] sm:px-6">
                Lượt quét này chưa có file video preview. Hãy cập nhật ứng dụng và quét lại để đồng bộ video có thể phát.
              </p>
            )}

            {confirmingDelete && (
              <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="presentation">
                <section role="alertdialog" aria-modal="true" aria-labelledby="delete-media-title" aria-describedby="delete-media-description" className="w-full max-w-md rounded-3xl border bg-[var(--surface)] p-6 text-[var(--ink)] shadow-2xl">
                  <span className="grid size-12 place-items-center rounded-2xl bg-red-500/12 text-red-600 dark:text-red-300"><Trash2 size={23} aria-hidden="true" /></span>
                  <h2 id="delete-media-title" className="mt-5 text-xl font-bold">Xoá media này?</h2>
                  <p id="delete-media-description" className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
                    Media, thumbnail và file preview đã đồng bộ sẽ bị xoá khỏi server. Hành động này được ghi vào audit log và không thể hoàn tác.
                  </p>
                  {deleteError && <p role="alert" className="mt-4 rounded-2xl bg-red-500/10 p-3 text-sm text-[var(--danger)]">{deleteError}</p>}
                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button type="button" onClick={() => { setConfirmingDelete(false); setDeleteError(""); }} disabled={deleting} className="min-h-12 cursor-pointer rounded-2xl border px-5 text-sm font-semibold transition hover:bg-[var(--surface-raised)] disabled:opacity-50">Huỷ</button>
                    <button type="button" onClick={() => void deleteActiveAsset()} disabled={deleting} className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
                      {deleting ? <LoaderCircle className="animate-spin motion-reduce:animate-none" size={18} aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}
                      {deleting ? "Đang xoá…" : "Xoá vĩnh viễn"}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
