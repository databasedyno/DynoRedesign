/**
 * Admin-console auth endpoints (SEC-002). Two-step login (password -> TOTP),
 * first-login enrollment, session logout / logout-all / list, and step-up.
 */
import express from "express";
import { successResponseHelper, errorResponseHelper } from "../helper";
import { adminLogger } from "../utils/loggers";
import {
  passwordPhase,
  beginEnrollment,
  completeEnrollment,
  totpPhase,
  revokeSession,
  revokeAllSessions,
  listSessions,
  verifyStepUp,
  getAdminStatus,
  AdminAuthError,
} from "../services/adminAuthService";
import {
  trustAdminDevice,
  clearAdminDeviceCookie,
  revokeAllAdminTrustedDevices,
} from "../services/adminTrustedDevice";

const fail = (res: express.Response, e: unknown) => {
  if (e instanceof AdminAuthError) return errorResponseHelper(res, e.status, e.message);
  adminLogger.error("[adminAuth] unexpected error", e as Error);
  return errorResponseHelper(res, 500, "Something went wrong. Please try again.");
};

const loginPassword = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) throw new AdminAuthError(400, "Email and password are required.");
    const result = await passwordPhase(email, password, req);
    const msg = result.status === "OK" ? "Login Success!" : "Enter your verification code";
    return successResponseHelper(res, 200, msg, result);
  } catch (e) {
    return fail(res, e);
  }
};

const loginTotp = async (req: express.Request, res: express.Response) => {
  try {
    const { challengeToken, code, trustDevice } = req.body || {};
    if (!challengeToken || !code) throw new AdminAuthError(400, "Verification code is required.");
    const { adminId, ...result } = await totpPhase(String(challengeToken), String(code), req);
    if (trustDevice !== false) await trustAdminDevice(adminId, req, res);
    return successResponseHelper(res, 200, "Login Success!", result);
  } catch (e) {
    return fail(res, e);
  }
};

const enrollBegin = async (req: express.Request, res: express.Response) => {
  try {
    const { enrollToken } = req.body || {};
    if (!enrollToken) throw new AdminAuthError(400, "Enrollment session is required.");
    const result = await beginEnrollment(String(enrollToken));
    return successResponseHelper(res, 200, "Scan the QR code with your authenticator app", result);
  } catch (e) {
    return fail(res, e);
  }
};

const enrollComplete = async (req: express.Request, res: express.Response) => {
  try {
    const { enrollToken, code, trustDevice } = req.body || {};
    if (!enrollToken || !code) throw new AdminAuthError(400, "Verification code is required.");
    const { adminId, ...result } = await completeEnrollment(String(enrollToken), String(code), req);
    if (trustDevice !== false) await trustAdminDevice(adminId, req, res);
    return successResponseHelper(res, 200, "Two-factor authentication enabled", result);
  } catch (e) {
    return fail(res, e);
  }
};

const logout = async (_req: express.Request, res: express.Response) => {
  try {
    const sid = (res.locals.user as { sid?: string })?.sid;
    if (sid) await revokeSession(sid);
    return successResponseHelper(res, 200, "Signed out");
  } catch (e) {
    return fail(res, e);
  }
};

const logoutAll = async (_req: express.Request, res: express.Response) => {
  try {
    const user = res.locals.user as { admin_id?: number };
    if (user?.admin_id) {
      await revokeAllSessions(user.admin_id);
      await revokeAllAdminTrustedDevices(user.admin_id);
    }
    clearAdminDeviceCookie(res);
    return successResponseHelper(res, 200, "Signed out of all devices");
  } catch (e) {
    return fail(res, e);
  }
};

const sessions = async (_req: express.Request, res: express.Response) => {
  try {
    const user = res.locals.user as { admin_id?: number; sid?: string };
    const rows = await listSessions(user.admin_id!, user.sid);
    return successResponseHelper(res, 200, "Active sessions", { sessions: rows });
  } catch (e) {
    return fail(res, e);
  }
};

const me = async (_req: express.Request, res: express.Response) => {
  try {
    const user = res.locals.user as { admin_id?: number };
    const status = await getAdminStatus(user.admin_id!);
    return successResponseHelper(res, 200, "Admin profile", status);
  } catch (e) {
    return fail(res, e);
  }
};

const stepUp = async (req: express.Request, res: express.Response) => {
  try {
    const user = res.locals.user as { admin_id?: number; sid?: string };
    const { reason, code } = req.body || {};
    if (!reason || !code) throw new AdminAuthError(400, "Reason and verification code are required.");
    const result = await verifyStepUp(user.admin_id!, user.sid!, String(reason), String(code));
    return successResponseHelper(res, 200, "Verified", result);
  } catch (e) {
    return fail(res, e);
  }
};

export default {
  loginPassword,
  loginTotp,
  enrollBegin,
  enrollComplete,
  logout,
  logoutAll,
  sessions,
  me,
  stepUp,
};
