/**
 * Trusted devices (browsers that skip the 2FA challenge for 90 rolling days).
 * - GET    /user/trusted-devices      — list (flags the caller's browser)
 * - DELETE /user/trusted-devices/:id  — forget one
 * - DELETE /user/trusted-devices      — forget all (this browser will be challenged next sign-in)
 */
import express from "express";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { userLogger } from "../utils/loggers";
import { IUserType } from "../utils/types";
import {
  listTrustedDevices,
  revokeTrustedDevice,
  revokeAllTrustedDevices,
  clearDeviceCookie,
  TRUSTED_DEVICE_DAYS,
} from "../services/session/trustedDevices";

const list = async (req: express.Request, res: express.Response) => {
  try {
    const { user_id } = res.locals.user as IUserType;
    const devices = await listTrustedDevices(user_id, req);
    successResponseHelper(res, 200, "Trusted devices retrieved", { devices, total: devices.length, trust_days: TRUSTED_DEVICE_DAYS });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

const revokeOne = async (req: express.Request, res: express.Response) => {
  try {
    const { user_id } = res.locals.user as IUserType;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return errorResponseHelper(res, 400, "Invalid device ID");
    const ok = await revokeTrustedDevice(user_id, id);
    if (!ok) return errorResponseHelper(res, 404, "Device not found or already forgotten");
    successResponseHelper(res, 200, "Device forgotten. It will be asked for a code next time.");
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

const revokeAll = async (req: express.Request, res: express.Response) => {
  try {
    const { user_id } = res.locals.user as IUserType;
    const n = await revokeAllTrustedDevices(user_id);
    clearDeviceCookie(res);
    successResponseHelper(res, 200, "All devices forgotten. Every browser will be asked for a code next time.", { revoked: n });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

export default { list, revokeOne, revokeAll };
