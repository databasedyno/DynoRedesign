/**
 * customerAnnotationController.ts — WRITE side of the Customers directory:
 * merchant-private notes / tags / name & mobile overrides, and manually-added
 * contacts. Reads still flow through customerDirectoryController (which now
 * folds these annotations in). Every write is company-scoped + permission-gated
 * (manage_customers) and busts the directory cache.
 */
import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { IUserType } from "../utils/types";
import { apiLogger } from "../utils/loggers";
import { validateCompanyOwnership } from "../utils/validateCompanyOwnership";
import { customerAnnotationModel } from "../models";
import { invalidateDirectoryCache } from "./customerDirectoryService";

const cleanTags = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = String(item ?? "").trim().slice(0, 40);
    if (s && !out.includes(s) && out.length < 20) out.push(s);
  }
  return out;
};

const emailKey = (raw: unknown): string | null => {
  const v = String(raw ?? "").trim().toLowerCase();
  return v.includes("@") && v.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null;
};

/** Ownership + manage_customers check; returns {companyId, ownerUserId} or null (403/400 already sent). */
const resolveWriteScope = async (
  req: express.Request,
  res: express.Response,
  userData: IUserType
): Promise<{ companyId: number; ownerUserId: number } | null> => {
  const companyIdParam = (req.body?.company_id as string) || (req.headers["x-company-id"] as string) || "";
  if (!companyIdParam) {
    errorResponseHelper(res, 400, "company_id is required");
    return null;
  }
  const companyData = await validateCompanyOwnership(res, companyIdParam, userData.user_id, "manage_customers");
  if (!companyData) return null; // 403 already sent
  return { companyId: Number(companyIdParam), ownerUserId: Number((companyData as unknown as { user_id: number }).user_id) };
};

const bustCache = async (ownerUserId: number, companyId: number) => {
  await invalidateDirectoryCache(ownerUserId, companyId);
  await invalidateDirectoryCache(ownerUserId, null);
};

/**
 * POST /api/userApi/customers/annotation
 * Body: { company_id, key|email, notes?, tags?, display_name?, mobile? }
 * Upserts merchant-private annotations for an existing directory identity.
 */
const upsertAnnotation = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const scope = await resolveWriteScope(req, res, userData);
    if (!scope) return;
    const email = emailKey(req.body?.key ?? req.body?.email);
    if (!email) return errorResponseHelper(res, 400, "A valid customer email is required");

    const patch: Record<string, unknown> = {};
    if (req.body?.notes !== undefined) patch.notes = req.body.notes != null ? String(req.body.notes).slice(0, 5000) : null;
    if (req.body?.tags !== undefined) patch.tags = cleanTags(req.body.tags);
    if (req.body?.display_name !== undefined) patch.display_name = String(req.body.display_name ?? "").trim().slice(0, 120) || null;
    if (req.body?.mobile !== undefined) patch.mobile = String(req.body.mobile ?? "").trim().slice(0, 40) || null;

    const existing = await customerAnnotationModel.findOne({ where: { company_id: scope.companyId, email } });
    if (existing) {
      await customerAnnotationModel.update(patch, { where: { company_id: scope.companyId, email } });
    } else {
      await customerAnnotationModel.create({
        company_id: scope.companyId,
        email,
        notes: (patch.notes as string) ?? null,
        tags: (patch.tags as string[]) ?? null,
        display_name: (patch.display_name as string) ?? null,
        mobile: (patch.mobile as string) ?? null,
        created_manually: false,
      });
    }

    await bustCache(scope.ownerUserId, scope.companyId);
    return successResponseHelper(res, 200, "Customer details saved", { key: email, email });
  } catch (e) {
    handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

/**
 * POST /api/userApi/customers/manual
 * Body: { company_id, email, name?, mobile?, notes?, tags? }
 * Adds a contact manually (appears as a "prospect" until they pay).
 */
const createManualCustomer = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const scope = await resolveWriteScope(req, res, userData);
    if (!scope) return;
    const email = emailKey(req.body?.email);
    if (!email) return errorResponseHelper(res, 400, "A valid email is required to add a customer");

    const display_name = String(req.body?.name ?? "").trim().slice(0, 120) || null;
    const mobile = String(req.body?.mobile ?? "").trim().slice(0, 40) || null;
    const notes = req.body?.notes != null ? String(req.body.notes).slice(0, 5000) : null;
    const tags = cleanTags(req.body?.tags);

    const existing = (await customerAnnotationModel.findOne({
      where: { company_id: scope.companyId, email },
    })) as unknown as { display_name?: string; mobile?: string; notes?: string; tags?: string[] } | null;

    if (existing) {
      // Don't clobber existing values with blanks — only fill what was provided.
      await customerAnnotationModel.update(
        {
          created_manually: true,
          display_name: display_name ?? existing.display_name ?? null,
          mobile: mobile ?? existing.mobile ?? null,
          notes: notes ?? existing.notes ?? null,
          tags: tags.length ? tags : existing.tags ?? null,
        },
        { where: { company_id: scope.companyId, email } }
      );
    } else {
      await customerAnnotationModel.create({
        company_id: scope.companyId,
        email,
        display_name,
        mobile,
        notes,
        tags,
        created_manually: true,
      });
    }

    await bustCache(scope.ownerUserId, scope.companyId);
    return successResponseHelper(res, 200, "Customer added", { key: email, email });
  } catch (e) {
    handleControllerError(res, e, apiLogger, { user_id: userData.user_id, email: userData.email });
  }
};

export default { upsertAnnotation, createManualCustomer };
