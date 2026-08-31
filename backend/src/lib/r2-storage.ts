import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const referencePrefix = "r2:";
let cachedClient: S3Client | undefined;
let cachedUsage: { expiresAt: number; value: R2UsageSnapshot } | undefined;

const usageCacheMs = 5 * 60_000;

type R2Config = {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type R2UsageSnapshot = {
  bucket: string;
  prefix: string;
  bytes: number;
  objectCount: number;
  measuredAt: Date;
};

function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const endpoint = process.env.R2_ENDPOINT?.trim() || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;
  return { bucket, endpoint, accessKeyId, secretAccessKey };
}

function requireR2Config() {
  const config = r2Config();
  if (!config) throw new Error("R2_NOT_CONFIGURED");
  return config;
}

function r2Client() {
  if (cachedClient) return cachedClient;
  const config = requireR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    forcePathStyle: process.env.R2_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  return cachedClient;
}

export function r2Configured() {
  const configured = r2Config() !== null;
  if (process.env.R2_REQUIRED === "true" && !configured) throw new Error("R2_NOT_CONFIGURED");
  return configured;
}

export function r2ConfigurationStatus() {
  return { required: process.env.R2_REQUIRED === "true", configured: r2Config() !== null };
}

export function isR2Reference(reference: string) {
  return reference.startsWith(referencePrefix);
}

export function r2Reference(objectKey: string) {
  if (!objectKey || objectKey.startsWith("/") || objectKey.includes("..")) throw new Error("INVALID_R2_KEY");
  return `${referencePrefix}${objectKey}`;
}

export function r2ObjectKey(reference: string) {
  if (!isR2Reference(reference)) throw new Error("INVALID_R2_REFERENCE");
  return reference.slice(referencePrefix.length);
}

export function r2MediaPrefix() {
  return (process.env.R2_MEDIA_PREFIX?.trim() || "snapkit-media").replace(/^\/+|\/+$/g, "");
}

export function mediaR2Reference(
  userId: string,
  assetId: string,
  kind: "original" | "preview",
  extension: string,
) {
  const prefix = r2MediaPrefix();
  return r2Reference(`${prefix}/users/${userId}/assets/${assetId}/${kind}.${extension}`);
}

export async function r2UsageSnapshot() {
  const now = Date.now();
  if (cachedUsage && cachedUsage.expiresAt > now) return cachedUsage.value;

  const config = requireR2Config();
  const prefix = `${r2MediaPrefix()}/`;
  let continuationToken: string | undefined;
  let bytes = 0;
  let objectCount = 0;

  do {
    const page = await r2Client().send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of page.Contents ?? []) {
      bytes += object.Size ?? 0;
      objectCount++;
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  const value = { bucket: config.bucket, prefix, bytes, objectCount, measuredAt: new Date(now) };
  cachedUsage = { expiresAt: now + usageCacheMs, value };
  return value;
}

function uploadExpirySeconds() {
  const configured = Number(process.env.R2_UPLOAD_URL_TTL_SECONDS ?? "900");
  return Number.isFinite(configured) ? Math.min(3_600, Math.max(60, Math.trunc(configured))) : 900;
}

function readExpirySeconds() {
  const configured = Number(process.env.R2_READ_URL_TTL_SECONDS ?? "300");
  return Number.isFinite(configured) ? Math.min(3_600, Math.max(60, Math.trunc(configured))) : 300;
}

export async function createR2Upload(reference: string, mimeType: string, bytes: number) {
  const config = requireR2Config();
  const expiresIn = uploadExpirySeconds();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: r2ObjectKey(reference),
    ContentType: mimeType,
    ContentLength: bytes,
  });
  return {
    url: await getSignedUrl(r2Client(), command, { expiresIn }),
    expiresAt: new Date(Date.now() + expiresIn * 1_000),
    headers: { "content-type": mimeType, "content-length": String(bytes) },
  };
}

export async function createR2ReadUrl(
  reference: string,
  options: { mimeType: string; fileName: string; download: boolean },
) {
  const config = requireR2Config();
  const disposition = `${options.download ? "attachment" : "inline"}; filename="${options.fileName.replace(/["\\]/g, "_")}"`;
  return getSignedUrl(
    r2Client(),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: r2ObjectKey(reference),
      ResponseContentType: options.mimeType,
      ResponseContentDisposition: disposition,
    }),
    { expiresIn: readExpirySeconds() },
  );
}

export async function headR2Object(reference: string) {
  const config = requireR2Config();
  const response = await r2Client().send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: r2ObjectKey(reference) }),
  );
  return { size: response.ContentLength ?? 0, mimeType: response.ContentType ?? null };
}

export async function deleteR2Object(reference: string) {
  const config = requireR2Config();
  await r2Client().send(new DeleteObjectCommand({ Bucket: config.bucket, Key: r2ObjectKey(reference) }));
}

export async function r2ObjectStream(reference: string, start?: number, end?: number) {
  const config = requireR2Config();
  const range = start === undefined ? undefined : `bytes=${start}-${end ?? ""}`;
  const response = await r2Client().send(
    new GetObjectCommand({ Bucket: config.bucket, Key: r2ObjectKey(reference), Range: range }),
  );
  if (!response.Body) throw new Error("R2_OBJECT_EMPTY");
  return response.Body.transformToWebStream() as ReadableStream<Uint8Array>;
}

export async function downloadR2Object(reference: string, destination: string) {
  const config = requireR2Config();
  const response = await r2Client().send(
    new GetObjectCommand({ Bucket: config.bucket, Key: r2ObjectKey(reference) }),
  );
  if (!response.Body) throw new Error("R2_OBJECT_EMPTY");
  await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(destination, { flags: "wx" }));
}

export async function uploadR2File(reference: string, source: string, mimeType: string, bytes: number) {
  const config = requireR2Config();
  await r2Client().send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: r2ObjectKey(reference),
      Body: createReadStream(source),
      ContentType: mimeType,
      ContentLength: bytes,
    }),
  );
}
