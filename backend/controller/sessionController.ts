/**
 * Session Controller
 * 
 * Endpoints for session management:
 * - POST /refresh-token — Rotate refresh token
 * - GET /sessions — List active sessions
 * - DELETE /sessions/:id — Revoke a session
 * - DELETE /sessions — Revoke all other sessions
 * - GET /login-history — Get login history
 */
import express from "express";
import { errorResponseHelper, successResponseHelper } from "../helper";
import { handleControllerError } from "../helper/controllerErrorHandler";
import { userLogger } from "../utils/loggers";
import {
  rotateRefreshToken,
  getUserSessions,
  revokeSession,
  revokeAllOtherSessions,
  getLoginHistory,
} from "../services/sessionService";
import { IUserType } from "../utils/types";

/**
 * POST /api/user/refresh-token
 * Rotate refresh token — requires valid refresh token in body
 */
const refreshToken = async (req: express.Request, res: express.Response) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return errorResponseHelper(res, 400, "refresh_token is required");
    }

    const result = await rotateRefreshToken(refresh_token);

    if (!result) {
      return errorResponseHelper(res, 401, "Invalid or expired refresh token. Please login again.");
    }

    successResponseHelper(res, 200, "Token refreshed successfully", {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      token_type: "Bearer",
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * GET /api/user/sessions
 * List all active sessions for the authenticated user
 */
const listSessions = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    // Identify the caller's own session so the UI can label "This device".
    const authHeader = (req.headers.authorization as string) || "";
    const rawToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const currentTokenSuffix = rawToken ? rawToken.slice(-32) : null;
    const sessions = await getUserSessions(userData.user_id, currentTokenSuffix);

    successResponseHelper(res, 200, "Active sessions retrieved", {
      sessions,
      total: sessions.length,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * DELETE /api/user/sessions/:id
 * Revoke a specific session
 */
const revokeSessionEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const sessionId = parseInt(req.params.id);

    if (isNaN(sessionId)) {
      return errorResponseHelper(res, 400, "Invalid session ID");
    }

    const revoked = await revokeSession(sessionId, userData.user_id);

    if (!revoked) {
      return errorResponseHelper(res, 404, "Session not found or already revoked");
    }

    successResponseHelper(res, 200, "Session revoked successfully");
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * DELETE /api/user/sessions
 * Revoke all other sessions (keep current)
 */
const revokeAllOtherSessionsEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const currentSessionId = req.body.current_session_id;

    const count = await revokeAllOtherSessions(userData.user_id, currentSessionId);

    successResponseHelper(res, 200, `Revoked ${count} session(s)`, { revoked_count: count });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

/**
 * GET /api/user/login-history
 * Get login history for the authenticated user
 */
const loginHistory = async (req: express.Request, res: express.Response) => {
  try {
    const userData = res.locals.user as IUserType;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await getLoginHistory(userData.user_id, Math.min(limit, 100));

    successResponseHelper(res, 200, "Login history retrieved", {
      history,
      total: history.length,
    });
  } catch (e) {
    handleControllerError(res, e, userLogger);
  }
};

export default {
  refreshToken,
  listSessions,
  revokeSessionEndpoint,
  revokeAllOtherSessionsEndpoint,
  loginHistory,
};
