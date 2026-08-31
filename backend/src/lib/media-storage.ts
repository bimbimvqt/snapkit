import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
  "video/3gpp": "3gp",
  "video/webm": "webm",
};

export const imagePreviewMimeTypes = new Set(["image/jpeg"]);
export const videoPreviewMimeTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/3gpp",
  "video/webm",
]);

export function extensionForMimeType(mimeType: string) {
  return extensions[mimeType] ?? "bin";
}

export function maximumPreviewBytes() {
  const configured = Number(process.env.MEDIA_PREVIEW_MAX_MB ?? "1024");
  const megabytes = Number.isFinite(configured) ? Math.min(4096, Math.max(1, configured)) : 1024;
  return megabytes * 1024 * 1024;
}

export function mediaStorageRoot() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.MEDIA_STORAGE_DIR ??
      path.join(process.cwd(), ".media-previews"),
  );
}

export function storageKeyFor(assetId: string, mimeType: string) {
  const extension = extensions[mimeType];
  if (!extension) throw new Error("UNSUPPORTED_PREVIEW_TYPE");
  return `${assetId.slice(-2)}/${assetId}.${extension}`;
}

export function originalStorageKeyFor(assetId: string, mimeType: string) {
  const extension = extensions[mimeType];
  if (!extension) throw new Error("UNSUPPORTED_PREVIEW_TYPE");
  return `original/${assetId.slice(-2)}/${assetId}.${extension}`;
}

export function browserVideoStorageKeyFor(assetId: string) {
  return `preview/${assetId.slice(-2)}/${assetId}.mp4`;
}

export function resolveStoragePath(storageKey: string) {
  const root = mediaStorageRoot();
  const resolved = path.resolve(root, storageKey);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("INVALID_STORAGE_KEY");
  return resolved;
}

export async function storePreview(
  storageKey: string,
  body: ReadableStream<Uint8Array>,
  maximumBytes: number,
) {
  const destination = resolveStoragePath(storageKey);
  const temporary = `${destination}.${randomUUID()}.upload`;
  await mkdir(path.dirname(destination), { recursive: true });
  let bytes = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.byteLength;
      if (bytes > maximumBytes) {
        callback(new Error("PREVIEW_TOO_LARGE"));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(body as unknown as import("node:stream/web").ReadableStream<Uint8Array>),
      limiter,
      createWriteStream(temporary, { flags: "wx" }),
    );
    if (bytes === 0) throw new Error("EMPTY_PREVIEW");
    await rename(temporary, destination);
    return bytes;
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function removeStoredPreview(storageKey: string | null | undefined) {
  if (!storageKey) return;
  await rm(resolveStoragePath(storageKey), { force: true }).catch(() => undefined);
}

export async function storedPreview(storageKey: string) {
  const filePath = resolveStoragePath(storageKey);
  const details = await stat(/* turbopackIgnore: true */ filePath);
  return { filePath, size: details.size };
}

const videoTranscodes = new Map<string, Promise<number>>();
const videoTranscodeWaiters: Array<() => void> = [];
const maximumConcurrentVideoTranscodes = 2;
let activeVideoTranscodes = 0;

export function transcodeBrowserVideo(sourceStorageKey: string, destinationStorageKey: string) {
  const active = videoTranscodes.get(destinationStorageKey);
  if (active) return active;
  const transcode = withVideoTranscodeSlot(() => runVideoTranscode(sourceStorageKey, destinationStorageKey)).finally(() => {
    videoTranscodes.delete(destinationStorageKey);
  });
  videoTranscodes.set(destinationStorageKey, transcode);
  return transcode;
}

async function withVideoTranscodeSlot<T>(operation: () => Promise<T>) {
  if (activeVideoTranscodes >= maximumConcurrentVideoTranscodes) {
    await new Promise<void>((resolve) => videoTranscodeWaiters.push(resolve));
  } else {
    activeVideoTranscodes += 1;
  }
  try {
    return await operation();
  } finally {
    const next = videoTranscodeWaiters.shift();
    if (next) next();
    else activeVideoTranscodes -= 1;
  }
}

async function runVideoTranscode(sourceStorageKey: string, destinationStorageKey: string) {
  const source = resolveStoragePath(sourceStorageKey);
  const destination = resolveStoragePath(destinationStorageKey);
  const temporary = `${destination}.${randomUUID()}.mp4`;
  await mkdir(path.dirname(destination), { recursive: true });

  try {
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-y",
          "-i",
          source,
          "-map",
          "0:v:0",
          "-map",
          "0:a:0?",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-vf",
          "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-movflags",
          "+faststart",
          "-sn",
          temporary,
        ],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      let errorOutput = "";
      ffmpeg.stderr.setEncoding("utf8");
      ffmpeg.stderr.on("data", (chunk: string) => {
        errorOutput = `${errorOutput}${chunk}`.slice(-4_000);
      });
      ffmpeg.once("error", reject);
      ffmpeg.once("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`VIDEO_TRANSCODE_FAILED:${code ?? "unknown"}:${errorOutput}`));
      });
    });
    await rename(temporary, destination);
    return (await stat(destination)).size;
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function previewStream(filePath: string, start?: number, end?: number) {
  return Readable.toWeb(createReadStream(filePath, start === undefined ? undefined : { start, end })) as ReadableStream<Uint8Array>;
}

export type ByteRange = { start: number; end: number };

export function parseByteRange(header: string | null, size: number): ByteRange | null | false {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size <= 0) return false;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return false;

  let start: number;
  let end: number;
  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (!Number.isInteger(suffix) || suffix <= 0) return false;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Number(rawEnd) : size - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) return false;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}
