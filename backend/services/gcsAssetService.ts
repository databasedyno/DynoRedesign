/**
 * gcsAssetService — Google Cloud Storage adapter for product digital assets.
 *
 * WHY THIS EXISTS
 *   Product Catalog spec §9 asks for GCS-backed signed-URL delivery. In
 *   Phase 1 we ship a LOCAL-DISK backend (see uploadProductAsset.ts →
 *   `storage_backend='local'`) because it's the fastest path to shipping.
 *   That works on Emergent's persistent-volume preview and on any deploy
 *   that mounts `/app/uploads/` on a PVC.
 *
 *   HOWEVER, most containerised production hosts (DigitalOcean App Platform,
 *   Cloud Run, Fargate) treat the filesystem as ephemeral — every deploy
 *   wipes uploaded files, leaving paid buyers with dead download links.
 *
 *   This module is the seam that lets Phase 2 (or a hot-fix release) swap
 *   in GCS-backed storage without touching call sites. Read `isGcsConfigured()`
 *   from the download route before deciding whether to stream from local
 *   disk or hand out a GCS signed URL.
 *
 *   The uploader / downloader will call:
 *     - `isGcsConfigured()`   → sanity check env vars are present
 *     - `saveAssetToGcs()`    → upload a local temp file to GCS
 *     - `getGcsSignedUrl()`   → mint a 24h signed URL for a stored object
 *
 *   All three currently throw `E_GCS_NOT_IMPLEMENTED` — they exist as a
 *   contract so callers get a typed refusal rather than a hidden runtime
 *   fallback. Actual @google-cloud/storage wiring is a Phase 2 task.
 *
 *   Related env vars (already present in .env from Emergent bootstrap):
 *     PROJECT_ID              → e.g. "newdyno"
 *     GOOGLE_CLIENT_EMAIL     → dynopay-manager@newdyno.iam.gserviceaccount.com
 *     GOOGLE_CLIENT_KEY       → \n-escaped PEM private key
 *     GCS_PRODUCT_BUCKET      → e.g. "dynopay-product-assets"  (NEW — add on activation)
 */
import { apiLogger } from "../utils/loggers";
import { isSpacesEnabled, SPACES_BUCKET } from "./objectStorage";

export const GCS_PRODUCT_BUCKET = process.env.GCS_PRODUCT_BUCKET || "";

/**
 * True iff all required env vars are set. Called at boot + before any GCS op.
 * Note: this doesn't try to hit GCS — just checks config presence.
 */
export function isGcsConfigured(): boolean {
  return (
    !!process.env.PROJECT_ID &&
    !!process.env.GOOGLE_CLIENT_EMAIL &&
    !!process.env.GOOGLE_CLIENT_KEY &&
    !!GCS_PRODUCT_BUCKET
  );
}

/**
 * Upload a local file (e.g. multer temp path) to GCS.
 * Returns `{ bucket, object }` to persist on `tbl_product_asset`.
 */
export async function saveAssetToGcs(_localPath: string, _destinationKey: string): Promise<{
  bucket: string;
  object: string;
}> {
  throw new Error(
    "E_GCS_NOT_IMPLEMENTED: gcsAssetService.saveAssetToGcs is a Phase 2 hook. " +
    "Install @google-cloud/storage, wire credentials, and complete this stub before use."
  );
}

/**
 * Mint a short-lived (24h) signed URL for a stored object.
 * The caller wraps this in the HMAC token flow so buyer-side revoke is easy.
 */
export async function getGcsSignedUrl(_bucket: string, _object: string): Promise<string> {
  throw new Error(
    "E_GCS_NOT_IMPLEMENTED: gcsAssetService.getGcsSignedUrl is a Phase 2 hook. " +
    "Install @google-cloud/storage, wire credentials, and complete this stub before use."
  );
}

/**
 * Startup sanity check — logs a WARN if:
 *   - GCS is NOT configured, AND
 *   - The current NODE_ENV smells like production, AND
 *   - The local UPLOAD_ROOT is very likely NOT on a persistent volume
 *
 * The heuristic (path starts with /app/uploads/) is intentionally
 * conservative: on Emergent this survives restarts, but on plain
 * DigitalOcean App Platform it does not. Emit a hint, don't block boot.
 */
export function logStorageStrategyOnStartup(uploadRoot: string): void {
  const gcsOn = isGcsConfigured();
  const spacesOn = isSpacesEnabled();
  const looksProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const ephemeralHint =
    uploadRoot === "/app/uploads/products" || uploadRoot.startsWith("/app/uploads");

  // DigitalOcean Spaces (S3-compatible) is the primary durable backend. When it
  // is configured, product assets are uploaded as PRIVATE objects and streamed
  // back through the gated download route — nothing is lost on redeploy.
  if (spacesOn) {
    apiLogger.info(
      `[storage] Product asset backend: DigitalOcean Spaces (bucket=${SPACES_BUCKET}) — durable, private objects`
    );
    return;
  }

  if (gcsOn) {
    apiLogger.info(
      `[storage] Product asset backend: GCS bucket=${GCS_PRODUCT_BUCKET}`
    );
    return;
  }

  apiLogger.info(
    `[storage] Product asset backend: LOCAL DISK (UPLOAD_ROOT=${uploadRoot})`
  );

  if (looksProd && ephemeralHint) {
    apiLogger.warn(
      "[storage] ⚠️  Running in production with LOCAL DISK asset storage at " +
      `${uploadRoot}. On DigitalOcean App Platform / Cloud Run / Fargate, ` +
      "this filesystem is EPHEMERAL — every deploy will wipe uploaded product " +
      "files, leaving paid buyers with dead download links. Either mount a " +
      "persistent volume at UPLOAD_ROOT, configure DigitalOcean Spaces (set " +
      "SPACES_REGION/SPACES_BUCKET/SPACES_ACCESS_KEY/SPACES_SECRET_KEY), or " +
      "configure GCS (set GCS_PRODUCT_BUCKET and complete gcsAssetService stubs). " +
      "See PRODUCT_CATALOG_SPEC.md §9."
    );
  }
}
