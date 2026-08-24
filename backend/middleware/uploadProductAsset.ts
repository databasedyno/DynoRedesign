/**
 * Product-asset upload middleware.
 *
 * Accepts any file (digital deliverables can be ebooks, ZIPs, images, video,
 * license PDFs, ...). Enforces a size cap via env `PRODUCT_ASSET_MAX_MB`
 * (default 500 MB per spec §9). Rejects known-dangerous executables.
 *
 * Storage: local disk under UPLOAD_ROOT (default /app/uploads/products/).
 * A GCS backend can be swapped in later without touching callers — the
 * merchantUploadAsset controller records `storage_backend='local'|'gcs'` and
 * dispatches accordingly at download time.
 */
import { raw as envRaw } from "../utils/config";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import express from "express";
import { apiLogger } from "../utils/loggers";

export const UPLOAD_ROOT =
  envRaw("PRODUCT_UPLOAD_ROOT") || "/app/uploads/products";

export const ASSET_MAX_BYTES =
  Number(envRaw("PRODUCT_ASSET_MAX_MB") || 500) * 1024 * 1024;

// Blocked extensions — executable-adjacent formats that we refuse to host.
// Digital-goods merchants selling actual .exe installers can opt into a
// separate whitelist path in a later phase.
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".vbs", ".ps1",
  ".jar", ".sh", ".app", ".dmg",
]);

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (req: any, _file: any, cb: any) => {
    try {
      const userId = (res => Number((res as any)?.user?.user_id))(
        (req as any).res?.locals || {}
      );
      // Fall back to a shared "unassigned" dir if middleware ordering ever
      // misses the user context — controller re-checks ownership anyway.
      const merchantId = userId && userId > 0 ? String(userId) : "unassigned";
      const productId = String((req.params as any)?.productId || "tmp");
      const dir = path.join(UPLOAD_ROOT, merchantId, productId);
      ensureDir(dir);
      cb(null, dir);
    } catch (err) {
      apiLogger.error("[productAsset] destination resolve failed:", err);
      cb(err as Error, "");
    }
  },
  filename: (_req: any, file: any, cb: any) => {
    const rand = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 12);
    // Preserve original name in a URL-safe way but namespace it with a random
    // suffix to avoid collisions when the merchant uploads dup filenames.
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 80);
    cb(null, `${base}_${rand}${ext}`);
  },
});

export const uploadProductAsset = multer({
  storage,
  limits: { fileSize: ASSET_MAX_BYTES },
  fileFilter: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(
        new Error(
          `File type '${ext}' is blocked for security. Please upload the file zipped, or contact support to whitelist.`
        )
      );
    }
    cb(null, true);
  },
});

export default uploadProductAsset;
