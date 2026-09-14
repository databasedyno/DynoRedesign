import express from "express";
import jwt from "jsonwebtoken";
import { IUserType } from "../utils/types";
import { errorResponseHelper } from "../helper";
import { apiLogger } from "../utils/loggers";
import { readSession, stepUpChallengeBody, StepUpScope } from "../services/stepUpService";
import { isMfaHardWalled, mfaEnrollmentRequiredBody } from "../services/mfaEnforcement";

type Predicate = (req: express.Request, res: express.Response) => boolean | Promise<boolean>;

/**
 * Gate a route behind an active step-up session for `scope` (fail closed).
 * `when` (optional) skips the gate when it resolves false — e.g. adding a FIRST
 * email is onboarding, changing an existing one is a sensitive action.
 * Mandatory-2FA hard wall: once an un-enrolled account's 14-day grace window
 * has lapsed, every step-up-gated mutation (wallets, payouts, API keys, team…)
 * is refused with MFA_ENROLLMENT_REQUIRED until a second factor is enrolled.
 */
export const requireStepUp = (scope: StepUpScope, opts: { when?: Predicate } = {}) =>
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const userData = (res.locals.user as IUserType) || (jwt.decode(res.locals.token) as IUserType);
      if (!userData?.user_id) return errorResponseHelper(res, 401, "Authentication required.");
      if (opts.when && !(await opts.when(req, res))) return next();
      if (await isMfaHardWalled(userData.user_id)) return res.status(403).json(mfaEnrollmentRequiredBody());
      const { active } = await readSession(userData.user_id, scope);
      if (!active) return res.status(403).json(stepUpChallengeBody(scope));
      res.locals.stepUpScope = scope;
      return next();
    } catch (e) {
      apiLogger.error(`[stepUp] session check failed (${scope})`, e);
      return res.status(403).json(stepUpChallengeBody(scope));
    }
  };

export default requireStepUp;
