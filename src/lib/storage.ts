import "server-only";
import { randomBytes } from "node:crypto";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 through its S3-compatible API. Credentials come from the
// environment and never leave the server.
const PRESIGN_TTL_SECONDS = 60 * 60;

// Signed read links for private files. Video needs the full hour so playback and
// seeking keep working; downloads are fetched at once.
export const VIDEO_URL_TTL_SECONDS = 60 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

function hasCredentials() {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY,
  );
}

export function isStorageConfigured() {
  return Boolean(hasCredentials() && process.env.R2_BUCKET && process.env.R2_PUBLIC_URL);
}

// The second bucket holds lesson files. It has no public URL: every read is a
// signed link made on the server. Same account and credentials as the first.
export function isPrivateStorageConfigured() {
  return Boolean(hasCredentials() && process.env.R2_PRIVATE_BUCKET);
}

let client: S3Client | undefined;

function s3() {
  if (!hasCredentials()) throw new Error("Storage is not configured.");
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    // R2 does not support the SDK's newer default checksums on presigned requests.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

function publicBucket() {
  if (!isStorageConfigured()) throw new Error("Storage is not configured.");
  return process.env.R2_BUCKET!;
}

function privateBucket() {
  if (!isPrivateStorageConfigured()) throw new Error("Private storage is not configured.");
  return process.env.R2_PRIVATE_BUCKET!;
}

function sanitiseFilename(filename: string) {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot + 1) : "";
  const clean = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const name = clean(base).slice(0, 80) || "file";
  const extension = clean(ext).slice(0, 10);
  return extension ? `${name}.${extension}` : name;
}

// Keys are always made here, never taken from the client.
export function generateObjectKey(filename: string, now = new Date()) {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `media/${yyyy}/${mm}/${randomBytes(8).toString("hex")}-${sanitiseFilename(filename)}`;
}

// Key of a lesson file: lessons/<courseId>/<random>-<name>. The course id keeps
// a bucket listing readable and lets the access checks match key to course.
export function generatePrivateObjectKey(courseId: number, filename: string) {
  return `lessons/${courseId}/${randomBytes(8).toString("hex")}-${sanitiseFilename(filename)}`;
}

// ---------------------------------------------------------------------------
// Operations on either bucket. The exported functions below bind them.
// ---------------------------------------------------------------------------

async function putUrl(bucket: string, key: string, contentType: string) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: PRESIGN_TTL_SECONDS },
  );
}

async function startMultipart(bucket: string, key: string, contentType: string) {
  const result = await s3().send(
    new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
  );
  if (!result.UploadId) throw new Error("Storage did not return an upload id.");
  return result.UploadId;
}

async function partUrls(bucket: string, key: string, uploadId: string, partNumbers: number[]) {
  return Promise.all(
    partNumbers.map(async (partNumber) => ({
      partNumber,
      url: await getSignedUrl(
        s3(),
        new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
        { expiresIn: PRESIGN_TTL_SECONDS },
      ),
    })),
  );
}

async function finishMultipart(
  bucket: string,
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
) {
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }),
  );
}

async function cancelMultipart(bucket: string, key: string, uploadId: string) {
  await s3().send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }));
}

async function head(bucket: string, key: string) {
  try {
    const result = await s3().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: result.ContentLength ?? 0, contentType: result.ContentType ?? null };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}

async function readHead(bucket: string, key: string, length: number) {
  const result = await s3().send(
    new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${length - 1}` }),
  );
  if (!result.Body) return new Uint8Array();
  return result.Body.transformToByteArray();
}

async function remove(bucket: string, key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// ---------------------------------------------------------------------------
// Public bucket (media library)
// ---------------------------------------------------------------------------

export const presignPut = (key: string, contentType: string) => putUrl(publicBucket(), key, contentType);

export const createMultipartUpload = (key: string, contentType: string) =>
  startMultipart(publicBucket(), key, contentType);

export const presignParts = (key: string, uploadId: string, partNumbers: number[]) =>
  partUrls(publicBucket(), key, uploadId, partNumbers);

export const completeMultipartUpload = (
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
) => finishMultipart(publicBucket(), key, uploadId, parts);

export const abortMultipartUpload = (key: string, uploadId: string) =>
  cancelMultipart(publicBucket(), key, uploadId);

// Size and content type of a stored object, or null when it does not exist.
export const headObject = (key: string) => head(publicBucket(), key);

// First `length` bytes, for type sniffing and reading image dimensions.
export const readObjectHead = (key: string, length: number) => readHead(publicBucket(), key, length);

export const deleteObject = (key: string) => remove(publicBucket(), key);

// Safe to call without storage configured: returns null.
export function publicUrl(key: string) {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

// ---------------------------------------------------------------------------
// Private bucket (lesson files). Same operations; check isPrivateStorageConfigured()
// first, they throw when R2_PRIVATE_BUCKET is unset.
// ---------------------------------------------------------------------------

export const privateStorage = {
  presignPut: (key: string, contentType: string) => putUrl(privateBucket(), key, contentType),
  createMultipartUpload: (key: string, contentType: string) => startMultipart(privateBucket(), key, contentType),
  presignParts: (key: string, uploadId: string, partNumbers: number[]) =>
    partUrls(privateBucket(), key, uploadId, partNumbers),
  completeMultipartUpload: (key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) =>
    finishMultipart(privateBucket(), key, uploadId, parts),
  abortMultipartUpload: (key: string, uploadId: string) => cancelMultipart(privateBucket(), key, uploadId),
  headObject: (key: string) => head(privateBucket(), key),
  readObjectHead: (key: string, length: number) => readHead(privateBucket(), key, length),
  deleteObject: (key: string) => remove(privateBucket(), key),

  // A signed GET link. `filename` sets the name a download is saved under;
  // `inline` lets the browser show the file (video, PDF) instead of saving it.
  async presignGet(
    key: string,
    options: { expiresIn?: number; filename?: string; inline?: boolean; contentType?: string } = {},
  ) {
    const disposition = options.filename
      ? `${options.inline ? "inline" : "attachment"}; filename="${asciiFilename(options.filename)}"; filename*=UTF-8''${encodeURIComponent(options.filename)}`
      : options.inline
        ? "inline"
        : undefined;
    return getSignedUrl(
      s3(),
      new GetObjectCommand({
        Bucket: privateBucket(),
        Key: key,
        ResponseContentDisposition: disposition,
        ResponseContentType: options.contentType,
      }),
      { expiresIn: options.expiresIn ?? VIDEO_URL_TTL_SECONDS },
    );
  },
};

function asciiFilename(filename: string) {
  return filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
}
