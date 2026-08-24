/**
 * Object Storage (DigitalOcean Spaces, S3-compatible)
 * ─────────────────────────────────────────────────────────────────────────────
 * Durable storage for user-uploaded images (creator covers, campaign/product
 * images). DigitalOcean App Platform containers have an EPHEMERAL filesystem, so
 * anything written to local disk (public/images) is wiped on every redeploy.
 * When Spaces env vars are present we upload to Spaces and return a public
 * (optionally CDN) URL; otherwise we transparently fall back to the previous
 * local-disk behaviour, so nothing breaks if Spaces isn't configured.
 *
 * Required env: SPACES_REGION, SPACES_BUCKET, SPACES_ACCESS_KEY, SPACES_SECRET_KEY
 * Optional env: SPACES_ENDPOINT (default https://<region>.digitaloceanspaces.com),
 *               SPACES_CDN_ENDPOINT (e.g. https://<bucket>.<region>.cdn.digitaloceanspaces.com)
 */
import { raw as envRaw } from "../utils/config";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import type { Readable } from "stream";
import { apiLogger } from "../utils/loggers";

const REGION = (envRaw("SPACES_REGION") || "").trim();
const BUCKET = (envRaw("SPACES_BUCKET") || "").trim();
const ACCESS = (envRaw("SPACES_ACCESS_KEY") || "").trim();
const SECRET = (envRaw("SPACES_SECRET_KEY") || "").trim();
const ENDPOINT = (envRaw("SPACES_ENDPOINT") || (REGION ? `https://${REGION}.digitaloceanspaces.com` : "")).trim().replace(/\/$/, "");
const CDN = (envRaw("SPACES_CDN_ENDPOINT") || "").trim().replace(/\/$/, "");

export const isSpacesEnabled = (): boolean =>
  Boolean(REGION && BUCKET && ACCESS && SECRET && ENDPOINT);

let _client: S3Client | null = null;
const client = (): S3Client => {
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      endpoint: ENDPOINT,
      forcePathStyle: false, // DO Spaces uses virtual-hosted style
      credentials: { accessKeyId: ACCESS, secretAccessKey: SECRET },
    });
  }
  return _client;
};

const publicUrlFor = (key: string): string => {
  if (CDN) return `${CDN}/${key}`;
  return `https://${BUCKET}.${REGION}.digitaloceanspaces.com/${key}`;
};

/** Upload a buffer to Spaces (public-read) and return its public/CDN URL. */
export async function uploadBufferToSpaces(
  buffer: Buffer,
  filename: string,
  contentType: string,
  keyPrefix = "images"
): Promise<string> {
  const key = `${keyPrefix.replace(/\/$/, "")}/${filename}`;
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return publicUrlFor(key);
}

/**
 * Given a multer disk-stored file, return the public URL to store/return.
 * - Spaces enabled  → upload buffer to Spaces, remove the local copy, return Spaces/CDN URL.
 * - Spaces disabled → return the local static URL (previous behaviour).
 * Never throws for the Spaces path — on error it falls back to the local URL.
 */
export async function finalizeUploadedImage(
  file: Express.Multer.File,
  serverUrl: string
): Promise<string> {
  const localUrl = `${(serverUrl || "").replace(/\/$/, "")}/api/static/images/${file.filename}`;
  if (!isSpacesEnabled() || !file?.path) return localUrl;
  try {
    const buffer = await fs.promises.readFile(file.path);
    const url = await uploadBufferToSpaces(buffer, file.filename, file.mimetype);
    // Best-effort cleanup of the ephemeral local copy
    fs.promises.unlink(file.path).catch(() => { /* ignore */ });
    apiLogger.info(`[ObjectStorage] Uploaded ${file.filename} to Spaces bucket ${BUCKET}`);
    return url;
  } catch (e) {
    apiLogger.error(`[ObjectStorage] Spaces upload failed for ${file.filename}, falling back to local disk: ${(e as Error).message}`);
    return localUrl;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE object helpers — used for PAID product digital assets (deliverables).
// Unlike images above, these objects are uploaded with ACL "private": buyers
// never get a public URL. Downloads are streamed back through the server-gated
// /api/order/:publicRef/download/:assetId route (per-order token + rate limit),
// so access control is preserved exactly as with the local-disk backend.
// ─────────────────────────────────────────────────────────────────────────────

/** Bucket name (empty string when Spaces isn't configured). */
export const SPACES_BUCKET = BUCKET;

/** Non-secret config snapshot for diagnostics/logging. Never returns keys. */
export function spacesConfigSummary(): {
  enabled: boolean;
  bucket: string;
  region: string;
  endpoint: string;
  cdn: string | null;
} {
  return {
    enabled: isSpacesEnabled(),
    bucket: BUCKET,
    region: REGION,
    endpoint: ENDPOINT,
    cdn: CDN || null,
  };
}

/**
 * Upload a local file to Spaces as a PRIVATE object and return {bucket, object}.
 * Streams the file (with a known ContentLength) so large deliverables (up to the
 * 500 MB cap) don't have to be buffered fully in memory. Throws on failure so the
 * caller can fall back to local disk.
 */
export async function uploadPrivateFileToSpaces(
  localPath: string,
  key: string,
  contentType: string,
  contentLength?: number
): Promise<{ bucket: string; object: string }> {
  const cleanKey = key.replace(/^\/+/, "");
  let body: Buffer | fs.ReadStream;
  let length = contentLength;
  if (typeof length === "number" && length > 0) {
    body = fs.createReadStream(localPath);
  } else {
    const buf = await fs.promises.readFile(localPath);
    body = buf;
    length = buf.length;
  }
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: cleanKey,
      Body: body,
      ContentLength: length,
      ContentType: contentType || "application/octet-stream",
      ACL: "private",
    })
  );
  return { bucket: BUCKET, object: cleanKey };
}

/**
 * Fetch a stored PRIVATE object as a readable stream (for server-side streaming
 * to the buyer). Returns the body stream plus any content metadata Spaces reports.
 */
export async function getSpacesObjectStream(key: string): Promise<{
  stream: Readable;
  contentType?: string;
  contentLength?: number;
}> {
  const out = await client().send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key.replace(/^\/+/, "") })
  );
  return {
    stream: out.Body as Readable,
    contentType: out.ContentType,
    contentLength: typeof out.ContentLength === "number" ? out.ContentLength : undefined,
  };
}

/** Best-effort delete of a stored object (used by the storage self-test cleanup). */
export async function deleteSpacesObject(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({ Bucket: BUCKET, Key: key.replace(/^\/+/, "") })
  );
}
