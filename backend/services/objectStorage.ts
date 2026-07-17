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
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import { apiLogger } from "../utils/loggers";

const REGION = (process.env.SPACES_REGION || "").trim();
const BUCKET = (process.env.SPACES_BUCKET || "").trim();
const ACCESS = (process.env.SPACES_ACCESS_KEY || "").trim();
const SECRET = (process.env.SPACES_SECRET_KEY || "").trim();
const ENDPOINT = (process.env.SPACES_ENDPOINT || (REGION ? `https://${REGION}.digitaloceanspaces.com` : "")).trim().replace(/\/$/, "");
const CDN = (process.env.SPACES_CDN_ENDPOINT || "").trim().replace(/\/$/, "");

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
