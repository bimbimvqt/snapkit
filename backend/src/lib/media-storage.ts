import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
