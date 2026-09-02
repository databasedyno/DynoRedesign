import express from "express";
import jwt from "jsonwebtoken";
import { IUserType } from "../../utils/types";
import { errorResponseHelper, successResponseHelper } from "../../helper/index";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { userLogger } from "../../utils/loggers";
import {
  ACTIVATION_GATES,
  sendActivationGateEmail,
  type ActivationGate,
} from "../../services/email/activationGateEmail";

/**
 * POST /user/activation-nudge  { gate: "brand" | "wallet" | "kyc", company_id? }
 * Fired by the frontend the moment the /create-pay-link setup guard blocks a
 * merchant. The service re-verifies the gate server-side and dedups in Redis.
 */
export const sendActivationNudge = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const gate = String(req.body?.gate || "") as ActivationGate;
    if (!ACTIVATION_GATES.includes(gate)) {
      return errorResponseHelper(res, 400, "gate must be one of brand, wallet, kyc");
    }
    const rawCompany = req.body?.company_id;
    const companyId = rawCompany != null && rawCompany !== "" && Number.isFinite(Number(rawCompany)) ? Number(rawCompany) : null;

    const result = await sendActivationGateEmail(Number(userData.user_id), gate, companyId);
    return successResponseHelper(res, 200, "Activation nudge processed", result);
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};
