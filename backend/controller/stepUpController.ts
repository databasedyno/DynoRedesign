import express from "express";
import { IUserType } from "../utils/types";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { apiLogger } from "../utils/loggers";
import {
  getStepUpStatus,
  isStepUpScope,
  requestStepUpCode,
  revokeStepUp,
  StepUpError,
  StepUpMethod,
  verifyStepUp,
} from "../services/stepUpService";

const scopeOf = (req: express.Request, res: express.Response) => {
  const scope = req.params.scope;
  if (!isStepUpScope(scope)) {
    errorResponseHelper(res, 400, "Unknown verification scope.");
    return null;
  }
  return scope;
};

const fail = (res: express.Response, e: unknown, ctx: Record<string, unknown>) => {
  if (e instanceof StepUpError) return errorResponseHelper(res, e.status, e.message);
  if ((e as Error)?.message?.includes("locked")) return errorResponseHelper(res, 429, (e as Error).message);
  return handleControllerError(res, e, apiLogger, ctx);
};

// GET /api/stepup/:scope/status
export const status = async (req: express.Request, res: express.Response) => {
  const user = res.locals.user as IUserType;
  const scope = scopeOf(req, res);
  if (!scope) return;
  try {
    return successResponseHelper(res, 200, "OK", await getStepUpStatus(user.user_id, scope));
  } catch (e) {
    fail(res, e, { user_id: user?.user_id, scope });
  }
};

// POST /api/stepup/:scope/request-code
export const requestCode = async (req: express.Request, res: express.Response) => {
  const user = res.locals.user as IUserType;
  const scope = scopeOf(req, res);
  if (!scope) return;
  try {
    const data = await requestStepUpCode(user.user_id, scope);
    return successResponseHelper(res, 200, `Verification code sent to your ${data.channel === "sms" ? "phone" : "email"}`, data);
  } catch (e) {
    fail(res, e, { user_id: user?.user_id, scope });
  }
};

// POST /api/stepup/:scope/verify  { method: "email"|"sms"|"totp"|"backup", code }
export const verify = async (req: express.Request, res: express.Response) => {
  const user = res.locals.user as IUserType;
  const scope = scopeOf(req, res);
  if (!scope) return;
  try {
    const method = String(req.body?.method || "email") as StepUpMethod;
    const data = await verifyStepUp(user.user_id, scope, method, String(req.body?.code || ""));
    return successResponseHelper(res, 200, "Verified.", data);
  } catch (e) {
    fail(res, e, { user_id: user?.user_id, scope });
  }
};

// POST /api/stepup/:scope/revoke
export const revoke = async (req: express.Request, res: express.Response) => {
  const user = res.locals.user as IUserType;
  const scope = scopeOf(req, res);
  if (!scope) return;
  try {
    await revokeStepUp(user.user_id, scope);
    return successResponseHelper(res, 200, "Locked.", { scope, active: false });
  } catch (e) {
    fail(res, e, { user_id: user?.user_id, scope });
  }
};

export default { status, requestCode, verify, revoke };
