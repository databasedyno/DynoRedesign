import express from "express";
import teamActivityModel from "../models/teamActivityModel";
import { apiLogger } from "./loggers";

/**
 * Team Activity Log — the write path. `auditMutations(domain)` is a router/route
 * middleware that records EVERY successful mutating request (POST/PUT/PATCH/DELETE
 * returning 2xx) as an append-only activity row, attributed to res.locals.user.
 *
 * Best-effort by design: it hooks res 'finish' and swallows all errors, so audit
 * logging can NEVER slow down or break the request it observes.
 */

export type CompanyResolver = (
  req: express.Request,
  res: express.Response
) => Promise<number | null> | number | null;

interface AuditOpts {
  action?: string;        // explicit machine action (per-route); else derived
  description?: string;   // explicit human line (per-route); else derived
  resolveCompany?: CompanyResolver; // explicit company resolver; else generic
}

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Generic company id: validatedCompany (set by ownership mw) -> header/body/query/params. */
const genericCompanyId = (req: express.Request, res: express.Response): number | null => {
  const fromLocals = (res.locals?.validatedCompany as { company_id?: number } | undefined)?.company_id;
  if (fromLocals) return Number(fromLocals);
  const raw =
    (req.headers["x-company-id"] as string | undefined) ??
    (req.body && (req.body.company_id as unknown)) ??
    (req.query && (req.query.company_id as unknown)) ??
    (req.params && (req.params.company_id as unknown));
  const n = parseInt(String(raw ?? ""), 10);
  return Number.isNaN(n) ? null : n;
};

/** Derive a short action + human description from the domain, method and path. */
function describe(domain: string, req: express.Request): { action: string; description: string } {
  const method = req.method.toUpperCase();
  const path = String(req.originalUrl || req.url || "").split("?")[0];
  const has = (s: string) => path.includes(s);

  if (domain === "company") {
    if (method === "DELETE" && has("/deleteCompany")) return { action: "company.delete", description: "Deleted a business" };
    if (has("/updateCompany")) return { action: "company.update", description: "Updated business profile" };
    if (has("/webhook-settings")) return { action: "company.webhook_settings", description: "Updated webhook settings" };
    if (has("/webhook-reenable")) return { action: "company.webhook_reenable", description: "Re-enabled the webhook" };
    if (has("/webhook-test")) return { action: "company.webhook_test", description: "Sent a test webhook" };
    if (has("/auto-convert")) return { action: "company.auto_convert", description: "Updated auto-convert settings" };
    if (has("/display-currency")) return { action: "company.display_currency", description: "Changed the display currency" };
    if (has("/retry")) return { action: "company.conversion_retry", description: "Retried a stablecoin conversion" };
    if (has("/addCompany")) return { action: "company.create", description: "Created a business" };
    return { action: "company.change", description: `Changed business settings` };
  }
  if (domain === "team") {
    if (has("/invite")) return { action: "team.invite", description: "Invited a team member" };
    if (method === "DELETE" && has("/members")) return { action: "team.revoke", description: "Removed a team member" };
    if (method === "PATCH" && has("/members")) return { action: "team.update", description: "Updated a member's role or permissions" };
    return { action: "team.change", description: "Changed the team" };
  }
  if (domain === "apikey") {
    if (has("/addApi")) return { action: "apikey.create", description: "Created an API key" };
    if (has("/updateApi")) return { action: "apikey.update", description: "Updated an API key" };
    if (has("/regenerate")) return { action: "apikey.regenerate", description: "Regenerated an API key" };
    if (has("/toggleStatus")) return { action: "apikey.toggle", description: "Changed an API key's status" };
    if (has("/revoke")) return { action: "apikey.revoke", description: "Revoked an API key" };
    if (has("/deleteApi")) return { action: "apikey.delete", description: "Deleted an API key" };
    return { action: "apikey.change", description: "Changed an API key" };
  }
  if (domain === "wallet") {
    if (has("/addWalletAddress")) return { action: "wallet.add", description: "Added a payout wallet" };
    if (has("/wallet/delete")) return { action: "wallet.delete", description: "Removed a payout wallet" };
    if (has("/wallet/update")) return { action: "wallet.update", description: "Updated the payout wallet" };
    if (has("/address") || has("/updateWallet")) return { action: "wallet.change", description: "Changed a payout wallet address" };
    return { action: "wallet.change", description: "Changed a payout wallet" };
  }
  return { action: `${domain}.change`, description: `${method} ${path}` };
}

async function record(
  req: express.Request,
  res: express.Response,
  domain: string,
  opts: AuditOpts
): Promise<void> {
  try {
    const user = res.locals?.user as { user_id?: number; email?: string } | undefined;
    const actorId = Number(user?.user_id) || null;
    if (!actorId) return; // unauthenticated actor (e.g. public accept) -> skip

    const companyId = opts.resolveCompany
      ? await opts.resolveCompany(req, res)
      : genericCompanyId(req, res);
    if (!companyId) return; // couldn't attribute to a business -> skip (never crash)

    const derived = describe(domain, req);
    const action = opts.action ?? derived.action;
    const description = opts.description ?? derived.description;

    await teamActivityModel.create({
      company_id: companyId,
      actor_user_id: actorId,
      actor_email: user?.email ?? null,
      action,
      description,
      method: req.method,
      path: String(req.originalUrl || req.url || "").split("?")[0].slice(0, 250),
      status_code: res.statusCode,
      meta: null,
    });
  } catch (e) {
    apiLogger.error("[activityLog] record failed:", e);
  }
}

/**
 * Middleware factory. Mount router-level (derives the action) or per-route (pass
 * an explicit action/description + resolveCompany for routes that key off a
 * resource id rather than company_id).
 */
export const auditMutations =
  (domain: string, opts: AuditOpts = {}) =>
  (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    if (!MUTATION_METHODS.has(req.method.toUpperCase())) return next();
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) void record(req, res, domain, opts);
    });
    next();
  };

export default auditMutations;
