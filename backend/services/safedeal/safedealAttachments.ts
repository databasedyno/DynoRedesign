/**
 * SafeDeal evidence attachments (delivery proof + dispute thread files).
 * Files are PRIVATE: stored in DO Spaces (or a non-public local dir when Spaces
 * isn't configured) and streamed through the API to deal parties / admins only.
 * Two-step: upload → row in context 'pending'; the deal action then binds the
 * ids to 'delivery' or 'dispute' (ref 'thread:<index>').
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import type express from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { isSpacesEnabled, uploadPrivateBufferToSpaces, getSpacesObjectStream } from "../objectStorage";
import { magicSniffBuffer } from "../../utils/fileMagicCheck";
import { apiLogger } from "../../utils/loggers";

export const ATTACH_MAX_FILES = 5;
export const ATTACH_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACH_ALLOWED: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};
export const LOCAL_PRIVATE_DIR = path.join(process.cwd(), "private_uploads", "safedeal");

export interface AttachmentRow {
  attachment_id: number;
  escrow_id: number;
  company_id: number | null;
  uploaded_by_role: string | null;
  uploaded_by_email: string | null;
  context: string;
  ref: string | null;
  file_name: string;
  mime: string;
  size_bytes: number;
  storage: "spaces" | "local";
  storage_key: string;
  created_at: string;
}

export interface AttachmentPublic {
  attachment_id: number;
  name: string;
  type: string;
  size: number;
  context: string;
  ref: string | null;
  by: string | null;
  created_at: string;
}

export const toPublic = (r: AttachmentRow): AttachmentPublic => ({
  attachment_id: Number(r.attachment_id),
  name: r.file_name,
  type: r.mime,
  size: Number(r.size_bytes),
  context: r.context,
  ref: r.ref,
  by: r.uploaded_by_role,
  created_at: r.created_at,
});

export class AttachmentError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Persist a multer (memory) upload as a pending attachment on the deal. */
export async function storeUpload(
  deal: { escrow_id: number; company_id: number },
  actor: { role: string; email: string },
  file: Express.Multer.File
): Promise<AttachmentPublic> {
  const ext = ATTACH_ALLOWED[file.mimetype];
  if (!ext) throw new AttachmentError(400, "Only PNG, JPG, WEBP, GIF images or PDF files are allowed.");
  if (file.size > ATTACH_MAX_BYTES) throw new AttachmentError(400, "File too large (max 10 MB).");
  const buffer = file.buffer;
  if (!buffer || !buffer.length) throw new AttachmentError(400, "The uploaded file is empty.");
  const bad = magicSniffBuffer(buffer);
  if (bad) throw new AttachmentError(400, `This file looks like a ${bad}, not an image or PDF.`);
  const pendingCount = await sequelize.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM tbl_escrow_attachment WHERE escrow_id = :id AND context = 'pending' AND LOWER(uploaded_by_email) = LOWER(:email)`,
    { replacements: { id: deal.escrow_id, email: actor.email }, type: QueryTypes.SELECT }
  );
  if (Number(pendingCount[0]?.n || 0) >= ATTACH_MAX_FILES * 2) throw new AttachmentError(429, "Too many unattached uploads — send your message first.");

  const key = `safedeal/deals/${deal.escrow_id}/${crypto.randomUUID()}${ext}`;
  let storage: "spaces" | "local" = "local";
  let storageKey = key;
  if (isSpacesEnabled()) {
    await uploadPrivateBufferToSpaces(buffer, key, file.mimetype);
    storage = "spaces";
  } else {
    // Preview / no object storage configured: private, non-served directory.
    const dest = path.join(LOCAL_PRIVATE_DIR, String(deal.escrow_id));
    await fs.promises.mkdir(dest, { recursive: true });
    storageKey = path.join(dest, path.basename(key));
    await fs.promises.writeFile(storageKey, buffer);
  }
  const rows = await sequelize.query<AttachmentRow>(
    `INSERT INTO tbl_escrow_attachment (escrow_id, company_id, uploaded_by_role, uploaded_by_email, context, file_name, mime, size_bytes, storage, storage_key)
     VALUES (:escrow_id, :company_id, :role, :email, 'pending', :name, :mime, :size, :storage, :key) RETURNING *`,
    {
      replacements: { escrow_id: deal.escrow_id, company_id: deal.company_id, role: actor.role, email: actor.email, name: String(file.originalname || "file").slice(0, 255), mime: file.mimetype, size: file.size, storage, key: storageKey },
      type: QueryTypes.SELECT,
    }
  );
  apiLogger.info(`[safedeal] attachment #${rows[0].attachment_id} stored (${storage}) for deal ${deal.escrow_id}`);
  return toPublic(rows[0]);
}

/** Validate that the ids are this actor's pending uploads on this deal. Returns the clean id list. */
export async function validatePendingIds(escrowId: number, ids: unknown, email: string): Promise<number[]> {
  const list = Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, ATTACH_MAX_FILES) : [];
  if (!list.length) return [];
  const rows = await sequelize.query<{ attachment_id: number }>(
    `SELECT attachment_id FROM tbl_escrow_attachment WHERE escrow_id = :id AND context = 'pending' AND LOWER(uploaded_by_email) = LOWER(:email) AND attachment_id IN (:ids)`,
    { replacements: { id: escrowId, email, ids: list }, type: QueryTypes.SELECT }
  );
  if (rows.length !== list.length) throw new AttachmentError(400, "One or more attachments are missing or already used — please re-attach.");
  return list;
}

export async function bindAttachments(escrowId: number, ids: number[], context: "delivery" | "dispute", ref: string | null): Promise<void> {
  if (!ids.length) return;
  await sequelize.query(
    `UPDATE tbl_escrow_attachment SET context = :context, ref = :ref WHERE escrow_id = :id AND context = 'pending' AND attachment_id IN (:ids)`,
    { replacements: { context, ref, id: escrowId, ids }, type: QueryTypes.UPDATE }
  );
}

export async function listAttachments(escrowId: number): Promise<AttachmentPublic[]> {
  const rows = await sequelize.query<AttachmentRow>(
    `SELECT * FROM tbl_escrow_attachment WHERE escrow_id = :id AND context <> 'pending' ORDER BY attachment_id ASC`,
    { replacements: { id: escrowId }, type: QueryTypes.SELECT }
  );
  return rows.map(toPublic);
}

export async function listAttachmentsForDeals(escrowIds: number[]): Promise<Record<number, AttachmentPublic[]>> {
  const out: Record<number, AttachmentPublic[]> = {};
  if (!escrowIds.length) return out;
  const rows = await sequelize.query<AttachmentRow>(
    `SELECT * FROM tbl_escrow_attachment WHERE escrow_id IN (:ids) AND context <> 'pending' ORDER BY attachment_id ASC`,
    { replacements: { ids: escrowIds }, type: QueryTypes.SELECT }
  );
  for (const r of rows) (out[Number(r.escrow_id)] ||= []).push(toPublic(r));
  return out;
}

export async function getAttachment(escrowId: number, attachmentId: number): Promise<AttachmentRow | null> {
  const rows = await sequelize.query<AttachmentRow>(
    `SELECT * FROM tbl_escrow_attachment WHERE escrow_id = :id AND attachment_id = :aid LIMIT 1`,
    { replacements: { id: escrowId, aid: attachmentId }, type: QueryTypes.SELECT }
  );
  return rows[0] || null;
}

export async function getAttachmentById(attachmentId: number): Promise<AttachmentRow | null> {
  const rows = await sequelize.query<AttachmentRow>(`SELECT * FROM tbl_escrow_attachment WHERE attachment_id = :aid LIMIT 1`, {
    replacements: { aid: attachmentId },
    type: QueryTypes.SELECT,
  });
  return rows[0] || null;
}

/** Stream a stored file to the response (inline for images/PDF). */
export async function streamAttachment(res: express.Response, row: AttachmentRow): Promise<void> {
  const safeName = row.file_name.replace(/[^\w.\- ()]/g, "_");
  res.setHeader("Content-Type", row.mime);
  res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (row.storage === "spaces") {
    const { stream, contentLength } = await getSpacesObjectStream(row.storage_key);
    if (contentLength) res.setHeader("Content-Length", String(contentLength));
    stream.pipe(res);
    return;
  }
  const stat = await fs.promises.stat(row.storage_key);
  res.setHeader("Content-Length", String(stat.size));
  fs.createReadStream(row.storage_key).pipe(res);
}
