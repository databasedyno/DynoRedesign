import express from "express";
import { Op } from "sequelize";
import { userModel, loginActivityModel } from "../../models";
import { userLogger } from "../../utils/loggers";
import { revokeAllUserSessions } from "../../services/sessionService";

// ────────────────────────────────────────────────────────────────────────────
// One-tap "sign out everywhere" (from the new-device alert email)
//
// PUBLIC + token-authorized by the per-login security_token (tbl_login_activity).
// GET only RENDERS a confirmation page so an email/AV link-prefetch (which issues
// GETs) can never revoke anything; the revocation happens on the explicit POST
// form submit. Token is single-use (flagged) and valid for 7 days. No login,
// no session cookie, no JWT — capability = possession of the 256-bit token.
// (Pattern per the security integration playbook.) Extracted from
// profileSecurity.ts to keep that module under the 500-line budget (R2).
// ────────────────────────────────────────────────────────────────────────────

const SIGNOUT_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SIGNOUT_TOKEN_RE = /^[a-f0-9]{16,128}$/i;

const escapeHtmlSec = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]));

const sendSecurityHtml = (
  res: express.Response,
  status: number,
  title: string,
  headline: string,
  bodyHtml: string
) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  res.status(status).type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtmlSec(title)}</title>
<style>
  body{margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0a0a0a;}
  .wrap{max-width:520px;margin:48px auto;padding:0 16px;}
  .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(15,15,20,.08);}
  .bar{height:5px;background:#4338CA;}
  .hdr{background:#050505;padding:20px;text-align:center;color:#fff;font-weight:800;letter-spacing:2px;font-size:16px;}
  .body{padding:30px 32px 34px;}
  h1{font-size:22px;font-weight:800;margin:0 0 14px;line-height:1.3;}
  p{font-size:15px;line-height:1.6;color:#374151;margin:0 0 14px;}
  .info{background:#fafaf9;border:1px solid #e7e5e4;border-left:4px solid #4338CA;border-radius:12px;padding:14px 18px;margin:18px 0;font-size:14px;color:#374151;}
  .info div{padding:3px 0;}
  .info b{color:#0a0a0a;}
  .btn{display:inline-block;background:#DC2626;color:#fff;text-decoration:none;padding:14px 28px;border:0;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer;}
  .ok{color:#15803d;font-weight:600;}
  .muted{font-size:13px;color:#6b7280;}
</style></head>
<body><div class="wrap"><div class="card"><div class="bar"></div><div class="hdr">DYNOPAY</div>
<div class="body"><h1>${escapeHtmlSec(headline)}</h1>${bodyHtml}</div></div>
<p class="muted" style="text-align:center;margin-top:18px;">Dynopay account security</p></div></body></html>`);
};

const INVALID_PAGE = (res: express.Response, status = 400) =>
  sendSecurityHtml(res, status, "Invalid link", "This link is invalid or has expired",
    `<p>For your security, these links expire after 7 days. Please sign in to Dynopay and review your active devices under <b>Settings</b>.</p>`);

export const signOutEverywhereConfirmPage = async (req: express.Request, res: express.Response) => {
  try {
    const token = String(req.query.token || "");
    if (!SIGNOUT_TOKEN_RE.test(token)) return INVALID_PAGE(res, 400);

    const cutoff = new Date(Date.now() - SIGNOUT_TOKEN_TTL_MS);
    const activity = (await loginActivityModel.findOne({
      where: { security_token: token, login_at: { [Op.gt]: cutoff } },
    })) as any;
    if (!activity) return INVALID_PAGE(res, 404);

    if (activity.dataValues.flagged) {
      return sendSecurityHtml(res, 200, "Already done", "You're already signed out everywhere",
        `<p class="ok">All devices were already signed out from this link.</p><p>Please sign in again with your password.</p>`);
    }

    const a = activity.dataValues;
    const deviceDisplay =
      [a.device, a.browser, a.os].filter((x: string) => x && x !== "Unknown").join(" · ") || "Unknown device";
    return sendSecurityHtml(res, 200, "Sign out everywhere", "Sign out of all devices?",
      `<p>If you don't recognize this sign-in, sign out of every device now and then change your password.</p>
       <div class="info">
         <div><b>Device:</b> ${escapeHtmlSec(deviceDisplay)}</div>
         <div><b>Location:</b> ${escapeHtmlSec(a.location || "Unknown location")}</div>
         <div><b>IP address:</b> ${escapeHtmlSec(a.ip_address || "Unknown")}</div>
       </div>
       <form method="post" action="/api/user/security/signout-everywhere" style="margin:22px 0 8px;">
         <input type="hidden" name="token" value="${escapeHtmlSec(token)}"/>
         <button class="btn" type="submit">This wasn't me — sign out everywhere</button>
       </form>
       <p class="muted">If this was you, you can safely close this page — no action needed.</p>`);
  } catch (e) {
    userLogger.error("[signOutEverywhere] confirm page error:", e);
    return sendSecurityHtml(res, 500, "Something went wrong", "Something went wrong",
      `<p>Please try again, or sign in to Dynopay and review your active devices under <b>Settings</b>.</p>`);
  }
};

export const signOutEverywhereAction = async (req: express.Request, res: express.Response) => {
  try {
    const token = String((req.body && req.body.token) || "");
    if (!SIGNOUT_TOKEN_RE.test(token)) return INVALID_PAGE(res, 400);

    const cutoff = new Date(Date.now() - SIGNOUT_TOKEN_TTL_MS);
    const activity = (await loginActivityModel.findOne({
      where: { security_token: token, login_at: { [Op.gt]: cutoff } },
    })) as any;
    if (!activity) return INVALID_PAGE(res, 404);

    const userId = activity.dataValues.user_id;

    // Atomic single-use consume (flagged=false guard). Revoking sessions is
    // itself idempotent, so a replay just re-revokes harmlessly.
    const [consumed] = await loginActivityModel.update(
      { flagged: true, flagged_at: new Date() },
      { where: { id: activity.dataValues.id, flagged: false } }
    );

    const count = await revokeAllUserSessions(userId, "signout_everywhere_email");
    userLogger.warn(`[SECURITY] User ${userId} used email one-tap sign-out-everywhere — revoked ${count} session(s) (activity ${activity.dataValues.id}, firstUse=${consumed > 0})`);

    if (consumed > 0) {
      try {
        const user = await userModel.findOne({ where: { user_id: userId } });
        if (user && user.dataValues.email) {
          const { sendSecurityAlertEmail } = await import("../../services/emailService");
          await sendSecurityAlertEmail(
            user.dataValues.email,
            user.dataValues.name || "User",
            "Signed out of all devices",
            "You signed out of every device from a new-device alert email. If you didn't do this, reset your password immediately."
          );
        }
      } catch (mailErr) {
        userLogger.error("[signOutEverywhere] confirmation email failed:", mailErr);
      }
    }

    return sendSecurityHtml(res, 200, "Signed out", "You're signed out everywhere",
      `<p class="ok">All devices have been signed out.</p>
       <p>For your security, sign in again with your password. If you didn't recognize that sign-in, change your password right away.</p>`);
  } catch (e) {
    userLogger.error("[signOutEverywhere] action error:", e);
    return sendSecurityHtml(res, 500, "Something went wrong", "Something went wrong",
      `<p>Please try again, or sign in to Dynopay and review your active devices under <b>Settings</b>.</p>`);
  }
};
